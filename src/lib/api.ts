import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'

import { lireAccessToken, useAuth } from '@/features/auth/store'

/**
 * Client HTTP unique de l'application, et ses deux intercepteurs.
 *
 * baseURL '/api' : le proxy Vite relaie vers le backend en développement, un reverse proxy
 * en production. Le navigateur ne voit donc qu'UNE origine — condition sans laquelle le
 * cookie SameSite=Strict du refresh token ne partirait jamais.
 *
 * withCredentials : sans lui, axios n'envoie ni ne reçoit de cookie. Le refresh token
 * serait posé par le serveur et jamais renvoyé — la session mourrait au bout de 15 minutes,
 * sans le moindre message d'erreur.
 */
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

/** Chemins d'authentification, relatifs à baseURL. */
export const CHEMIN_LOGIN = '/auth/login'
export const CHEMIN_REFRESH = '/auth/refresh'
export const CHEMIN_LOGOUT = '/auth/logout'
export const CHEMIN_CHANGER_MDP = '/auth/change-password'

/** En-tête par lequel le backend signale un mot de passe à renouveler (403). */
export const ENTETE_CODE_ERREUR = 'x-erreur-code'
export const CODE_MOT_DE_PASSE_A_RENOUVELER = 'password_change_required'

/** Marque une requête déjà rejouée après refresh, pour ne pas la rejouer indéfiniment. */
interface ConfigRejouable extends InternalAxiosRequestConfig {
  _rejoue?: boolean
}

// --- intercepteur de requête : porter le jeton ---------------------------------------

api.interceptors.request.use((config) => {
  const token = lireAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// --- rafraîchissement automatique -----------------------------------------------------

/**
 * LE POINT DÉLICAT — une seule tentative de refresh à la fois.
 *
 * Cette variable de module tient la promesse du refresh en cours. Si trois requêtes
 * échouent en 401 au même instant (un tableau de bord qui charge trois blocs, par exemple),
 * la deuxième et la troisième ATTENDENT cette promesse au lieu de lancer chacune la leur.
 *
 * Ce n'est pas une optimisation, c'est une nécessité. Le backend fait tourner le refresh
 * token à chaque usage et considère la réutilisation d'un jeton déjà consommé comme un VOL :
 * il révoque alors TOUTES les sessions de l'utilisateur. Trois refresh en parallèle, c'est
 * donc un premier qui réussit et deux qui présentent un jeton périmé — l'utilisateur est
 * déconnecté de partout, et le journal de conformité enregistre un « auth.token.
 * reuse_detected » qui fera croire à une attaque lors du prochain contrôle.
 *
 * Un intercepteur naïf déconnecte l'utilisateur au moment précis où il essaie de le sauver.
 */
/** Résultat d'un refresh : le nouveau jeton ET l'état du compte que l'API déclare. */
interface Rafraichissement {
  accessToken: string
  doitChangerMotDePasse: boolean
}

let refreshEnCours: Promise<Rafraichissement> | null = null

/**
 * Client DÉDIÉ au rafraîchissement — même configuration que `api`, mais SANS intercepteur.
 *
 * Une instance séparée plutôt que `api` : passer par `api` ferait repasser la réponse dans
 * l'intercepteur ci-dessous, donc un 401 sur le refresh relancerait un refresh, à l'infini.
 *
 * Et une instance plutôt qu'`axios` nu : elle hérite de la même baseURL, si bien que le
 * chemin '/api' n'est écrit qu'à un seul endroit. Le premier jet employait `axios.post` avec
 * un `/api` recodé à la main — ça marchait, mais ça dupliquait une constante d'architecture,
 * et surtout ça rendait l'intercepteur intestable : un simulateur branché sur `api`
 * n'interceptait pas ce chemin-là, et l'appel partait pour de vrai. Ce sont les tests qui
 * l'ont montré.
 */
export const clientRefresh = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

/**
 * Demande un nouveau couple de jetons. Le refresh token part TOUT SEUL dans le cookie —
 * le front ne le voit pas, ne le stocke pas, ne peut pas le lire.
 */
async function demanderRefresh(): Promise<Rafraichissement> {
  const reponse = await clientRefresh.post<{
    access_token: string
    must_change_password: boolean
  }>(CHEMIN_REFRESH, {})
  return {
    accessToken: reponse.data.access_token,
    // Le refresh relit l'état en base : c'est lui qui rattrape une réinitialisation faite
    // par un administrateur pendant que l'utilisateur travaillait.
    doitChangerMotDePasse: reponse.data.must_change_password,
  }
}

/** Refresh partagé : le premier appelant lance, les suivants attendent le même résultat. */
function rafraichir(): Promise<Rafraichissement> {
  refreshEnCours ??= demanderRefresh().finally(() => {
    // Libéré dans TOUS les cas, succès comme échec. Sans ce `finally`, un refresh échoué
    // laisserait une promesse rejetée en place et toute tentative ultérieure de
    // reconnexion échouerait sans jamais retoucher le réseau.
    refreshEnCours = null
  })
  return refreshEnCours
}

/**
 * Tente le refresh silencieux du démarrage.
 *
 * L'access token vit en mémoire : un simple F5 le perd. Sans cette tentative, chaque
 * rechargement de page renverrait l'utilisateur au formulaire de connexion — inacceptable
 * pour un outil de guichet où l'on rafraîchit dix fois par jour.
 *
 * UN ÉCHEC ICI EST NORMAL : il signifie « aucune session en cours », le cas de tout premier
 * visiteur. Il ne doit donc jamais produire de message d'erreur.
 */
export async function tenterReprendreSession(): Promise<void> {
  const { ouvrirSession, terminerAmorcage } = useAuth.getState()
  try {
    const { accessToken, doitChangerMotDePasse } = await rafraichir()
    ouvrirSession(accessToken, doitChangerMotDePasse)
  } catch {
    terminerAmorcage()
  }
}

api.interceptors.response.use(
  (reponse) => reponse,
  async (erreur: AxiosError) => {
    const config = erreur.config as ConfigRejouable | undefined

    if (!config || erreur.response?.status !== 401) {
      return Promise.reject(erreur)
    }

    // Trois exclusions, chacune pour une raison distincte :
    //
    //  - /auth/login : un 401 y est un mauvais mot de passe, pas une session expirée.
    //    Rafraîchir n'aurait aucun sens et masquerait l'échec réel à l'utilisateur.
    //  - /auth/refresh : son propre échec met fin à la session. Le rejouer bouclerait.
    //  - requête déjà rejouée : si elle échoue encore APRÈS un refresh réussi, le problème
    //    n'est pas le jeton. Insister ne ferait que marteler le serveur.
    const url = config.url ?? ''
    if (url.includes(CHEMIN_LOGIN) || url.includes(CHEMIN_REFRESH) || config._rejoue) {
      return Promise.reject(erreur)
    }

    try {
      const { accessToken, doitChangerMotDePasse } = await rafraichir()
      useAuth.getState().ouvrirSession(accessToken, doitChangerMotDePasse)
      config._rejoue = true
      config.headers.Authorization = `Bearer ${accessToken}`
      return api.request(config as AxiosRequestConfig)
    } catch {
      // Le refresh a échoué : le cookie est absent, périmé, ou les sessions ont été
      // révoquées. La session est finie, proprement.
      useAuth.getState().fermerSession()
      return Promise.reject(erreur)
    }
  },
)
