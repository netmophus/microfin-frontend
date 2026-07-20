import { AxiosError } from 'axios'

import type { CodeRegle } from '@/features/auth/politique'
import {
  api,
  CHEMIN_CHANGER_MDP,
  CHEMIN_LOGIN,
  CHEMIN_LOGOUT,
  CODE_MOT_DE_PASSE_A_RENOUVELER,
  ENTETE_CODE_ERREUR,
} from '@/lib/api'

/**
 * Appels d'authentification et TRADUCTION des réponses du serveur en cas métier.
 *
 * Le contrat est celui du backend, vérifié dans son code — pas celui qu'on suppose. En
 * particulier : le 423 renvoie `detail.verrou_jusqua`, imbriqué, et NON un `locked_until`
 * de premier niveau. S'être trompé là-dessus aurait donné un écran de verrouillage sans
 * date, sans erreur visible et sans rien dans la console.
 */

/** Réponse de POST /auth/login. Le refresh token n'y figure pas : il est dans le cookie. */
interface ReponseJetons {
  access_token: string
  token_type: string
  expires_in: number
  // Déclaré explicitement par l'API (et non déduit du claim du jeton) : c'est le contrat qui
  // dit au front de conduire l'utilisateur vers l'écran de renouvellement.
  must_change_password: boolean
}

/** Corps réel d'un 423 : { detail: { message, verrou_jusqua } }. */
interface DetailVerrou {
  message?: string
  verrou_jusqua?: string
}

/** Cas métier distincts que l'écran de connexion doit savoir présenter. */
export type EchecConnexion =
  | { type: 'identifiants' }
  | { type: 'verrouille'; verrouJusqua: string | null }
  | { type: 'motDePasseARenouveler' }
  | { type: 'reseau' }
  | { type: 'inattendue' }

export class ErreurConnexion extends Error {
  // Champ déclaré puis affecté, et non paramètre-propriété (`constructor(readonly …)`) :
  // `erasableSyntaxOnly` interdit cette syntaxe, qui n'est pas effaçable par un simple
  // retrait des types. Le projet garde ainsi du TypeScript que le bundler peut transpiler
  // sans le compiler.
  readonly echec: EchecConnexion

  constructor(echec: EchecConnexion) {
    super(echec.type)
    this.name = 'ErreurConnexion'
    this.echec = echec
  }
}

export interface ResultatConnexion {
  accessToken: string
  doitChangerMotDePasse: boolean
}

function extraireVerrou(donnees: unknown): string | null {
  if (typeof donnees !== 'object' || donnees === null) return null
  const detail = (donnees as { detail?: unknown }).detail
  if (typeof detail !== 'object' || detail === null) return null
  const echeance = (detail as DetailVerrou).verrou_jusqua
  return typeof echeance === 'string' ? echeance : null
}

/**
 * Connexion. Traduit les trois réponses réelles du backend, plus les pannes.
 *
 * Le 401 est VOLONTAIREMENT indifférencié côté serveur — compte inexistant, mauvais mot de
 * passe, compte désactivé, et même compte verrouillé avec un mauvais mot de passe donnent
 * le même corps. Le front ne doit rien inventer de plus précis : le faire reviendrait à
 * révéler l'existence d'un compte, ce que le serveur refuse justement de dire.
 */
export async function seConnecter(
  identifiant: string,
  motDePasse: string,
): Promise<ResultatConnexion> {
  try {
    const reponse = await api.post<ReponseJetons>(CHEMIN_LOGIN, {
      identifiant,
      mot_de_passe: motDePasse,
    })
    return {
      accessToken: reponse.data.access_token,
      doitChangerMotDePasse: reponse.data.must_change_password,
    }
  } catch (erreur) {
    throw new ErreurConnexion(traduire(erreur))
  }
}

function traduire(erreur: unknown): EchecConnexion {
  if (!(erreur instanceof AxiosError)) return { type: 'inattendue' }

  // Pas de réponse du tout : backend arrêté, proxy mal configuré, réseau coupé. L'utilisateur
  // doit pouvoir distinguer ce cas d'un mauvais mot de passe, sinon il ressaisit dix fois
  // des identifiants parfaitement corrects.
  if (!erreur.response) return { type: 'reseau' }

  const { status, headers, data } = erreur.response

  if (status === 401) return { type: 'identifiants' }

  if (status === 423) {
    return { type: 'verrouille', verrouJusqua: extraireVerrou(data) }
  }

  // 403 + en-tête dédié : la connexion a RÉUSSI, mais le compte est bridé tant que le mot
  // de passe n'a pas été renouvelé. Ce cas ne peut pas survenir sur /auth/login lui-même
  // (qui n'exige aucune permission) ; il est traité ici parce que la première requête
  // suivante le produira, et que l'écran doit savoir le nommer.
  if (status === 403 && headers?.[ENTETE_CODE_ERREUR] === CODE_MOT_DE_PASSE_A_RENOUVELER) {
    return { type: 'motDePasseARenouveler' }
  }

  return { type: 'inattendue' }
}

/**
 * Déconnexion. Le serveur révoque la session et efface le cookie ; il répond 204 même sans
 * session, donc l'appel ne peut pas « échouer » du point de vue de l'utilisateur.
 *
 * L'erreur est avalée à dessein : si le réseau tombe au moment où l'on se déconnecte, la
 * bonne issue reste d'oublier le jeton localement. Rester connecté parce que la déconnexion
 * a échoué serait le contraire de ce que l'utilisateur a demandé.
 */
export async function seDeconnecter(): Promise<void> {
  try {
    await api.post(CHEMIN_LOGOUT)
  } catch {
    // volontairement ignoré
  }
}

// --- changement de mot de passe (bloc « écran de renouvellement ») -------------------

/** Échecs distincts du changement, chacun appelant un geste différent de l'utilisateur. */
export type EchecMotDePasse =
  | { type: 'actuelIncorrect' } // 400 — l'ancien mot de passe est faux
  | { type: 'dejaUtilise' } // 409 — fait partie des 12 derniers (C12)
  | { type: 'politique'; violations: CodeRegle[] } // 422 — détail renvoyé par le serveur
  | { type: 'reseau' }
  | { type: 'inattendue' }

export class ErreurMotDePasse extends Error {
  readonly echec: EchecMotDePasse

  constructor(echec: EchecMotDePasse) {
    super(echec.type)
    this.name = 'ErreurMotDePasse'
    this.echec = echec
  }
}

/** Forme réelle du détail d'un 422 : { detail: { message, violations: string[] } }. */
function extraireViolations(donnees: unknown): CodeRegle[] {
  if (typeof donnees !== 'object' || donnees === null) return []
  const detail = (donnees as { detail?: unknown }).detail
  if (typeof detail !== 'object' || detail === null) return []
  const violations = (detail as { violations?: unknown }).violations
  return Array.isArray(violations) ? (violations.filter((v) => typeof v === 'string') as CodeRegle[]) : []
}

/**
 * Change le mot de passe. Le backend répond 204 sans corps ET NE RÉÉMET AUCUN JETON.
 *
 * C'est le point que le brief décrivait à l'envers : lire un `access_token` sur cette
 * réponse donnerait `undefined`, et le front garderait l'ancien jeton — celui qui porte
 * encore must_change_password=true. L'utilisateur aurait changé son mot de passe AVEC succès
 * et resterait bloqué. La réémission du jeton se fait par le refresh, cf. PageMotDePasse.
 *
 * Les mots de passe partent dans le CORPS, jamais dans l'URL ni un en-tête. En cas d'erreur,
 * on ne relaie que le CODE et les violations — jamais l'objet axios, dont config.data
 * contiendrait le corps en clair.
 */
export async function changerMotDePasse(actuel: string, nouveau: string): Promise<void> {
  try {
    await api.post(CHEMIN_CHANGER_MDP, {
      mot_de_passe_actuel: actuel,
      nouveau_mot_de_passe: nouveau,
    })
  } catch (erreur) {
    throw new ErreurMotDePasse(traduireMotDePasse(erreur))
  }
}

function traduireMotDePasse(erreur: unknown): EchecMotDePasse {
  if (!(erreur instanceof AxiosError)) return { type: 'inattendue' }
  if (!erreur.response) return { type: 'reseau' }

  const { status, data } = erreur.response
  if (status === 400) return { type: 'actuelIncorrect' }
  if (status === 409) return { type: 'dejaUtilise' }
  if (status === 422) return { type: 'politique', violations: extraireViolations(data) }
  return { type: 'inattendue' }
}
