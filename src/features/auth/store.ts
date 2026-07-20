import { create } from 'zustand'

/**
 * État d'authentification — l'access token vit EN MÉMOIRE, et nulle part ailleurs.
 *
 * PAS DE localStorage, PAS DE sessionStorage, PAS DE cookie lisible par JS. C'est la moitié
 * front de la décision prise côté serveur : le refresh token est dans un cookie httpOnly
 * (inaccessible à JS, donc hors de portée d'un XSS), et l'access token est court (15 min) et
 * volatil. Le ranger dans localStorage anéantirait tout l'édifice — n'importe quel script
 * injecté le lirait, et il y survivrait à la fermeture de l'onglet.
 *
 * Le prix à payer est que le token disparaît à chaque rechargement de page. La contrepartie
 * est le refresh silencieux au démarrage (cf. main.tsx) : le cookie, lui, a survécu, et
 * suffit à réémettre un access token sans que l'utilisateur ressaisisse quoi que ce soit.
 *
 * PAS de middleware `persist` de zustand, donc — et ce n'est pas un oubli. Quiconque
 * l'ajouterait « pour éviter de perdre la session » réintroduirait exactement la faille que
 * l'architecture évite.
 *
 * Le token est délibérément HORS de TanStack Query : ce n'est pas une donnée serveur qu'on
 * met en cache, c'est un état de session. Le mêler au cache exposerait au risque qu'un
 * outil de débogage ou une persistance de cache l'écrive sur disque.
 */

/** Étape d'amorçage : tant qu'on n'a pas tenté le refresh silencieux, on ne sait rien. */
export type EtatAmorcage = 'en_cours' | 'termine'

interface EtatAuth {
  /** null = pas de session. Jamais lu depuis un stockage persistant. */
  accessToken: string | null
  /**
   * Le compte doit renouveler son mot de passe (§6). Renseigné par la réponse de connexion.
   * Tant que c'est vrai, le backend refuse toute action : l'interface doit conduire
   * l'utilisateur vers l'écran de changement plutôt que de lui montrer des refus.
   */
  doitChangerMotDePasse: boolean
  /**
   * `en_cours` tant que le refresh silencieux du démarrage n'a pas rendu son verdict. Sans
   * cet état, l'application afficherait l'écran de connexion pendant la fraction de seconde
   * que dure le refresh — un clignotement à chaque F5, et l'impression d'être déconnecté.
   */
  amorcage: EtatAmorcage

  ouvrirSession: (accessToken: string, doitChangerMotDePasse?: boolean) => void
  fermerSession: () => void
  terminerAmorcage: () => void
}

export const useAuth = create<EtatAuth>((set) => ({
  accessToken: null,
  doitChangerMotDePasse: false,
  amorcage: 'en_cours',

  ouvrirSession: (accessToken, doitChangerMotDePasse = false) =>
    set({ accessToken, doitChangerMotDePasse, amorcage: 'termine' }),

  fermerSession: () =>
    set({ accessToken: null, doitChangerMotDePasse: false, amorcage: 'termine' }),

  terminerAmorcage: () => set({ amorcage: 'termine' }),
}))

/**
 * Lecture HORS composant React, pour l'intercepteur axios.
 *
 * Un intercepteur n'est pas un composant : il n'a ni hooks ni contexte. `getState` donne
 * accès au token courant au moment de la requête — et non à celui qui existait quand
 * l'intercepteur a été installé, ce qui serait toujours `null`.
 */
export const lireAccessToken = (): string | null => useAuth.getState().accessToken
