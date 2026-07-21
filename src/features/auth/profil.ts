import { api } from '@/lib/api'

/**
 * Profil de l'utilisateur connecté — GET /auth/me.
 *
 * Sépare l'IDENTITÉ (qui je suis, ce que je peux faire) de la SESSION (mon jeton). La
 * session vit dans le store zustand et se perd au rechargement ; le profil se RE-DEMANDE
 * après chaque chargement, ce qui rend un nom et des permissions qui survivent au F5.
 *
 * Les permissions viennent du serveur, jamais recalculées ici : le front n'a pas à
 * connaître la matrice rôles → permissions du backend. Il s'en sert pour n'AFFICHER que les
 * entrées permises — le serveur, lui, refuse (403) quoi qu'affiche le menu.
 */

export interface AgenceProfil {
  id: string
  code: string
  name: string
}

export interface RoleProfil {
  code: string
  name: string
}

export interface Profil {
  id: string
  username: string
  last_name: string
  first_name: string
  roles: RoleProfil[]
  permissions: string[]
  agence_courante: AgenceProfil | null
  must_change_password: boolean
}

export async function chargerProfil(): Promise<Profil> {
  const reponse = await api.get<Profil>('/auth/me')
  return reponse.data
}

/** Nom d'affichage : « Prénom Nom », ou l'identifiant à défaut. */
export function nomAffiche(profil: Profil): string {
  const complet = `${profil.first_name} ${profil.last_name}`.trim()
  return complet || profil.username
}
