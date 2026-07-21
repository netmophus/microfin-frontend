import { AxiosError } from 'axios'

import type { AgenceBreve } from '@/features/utilisateurs/api'
import { api } from '@/lib/api'

/**
 * Fiche détaillée d'un utilisateur et ses actions — GET /users/{id} + les cinq opérations.
 *
 * Reflète UtilisateurFiche côté serveur. Les erreurs sont traduites en cas MÉTIER distincts :
 * un 404 n'est pas une panne mais « hors de votre périmètre » (le cloisonnement rend la
 * personne inexistante de votre point de vue), un 403 est un refus de permission, un 409 un
 * conflit d'identifiant à la modification.
 */

export interface RoleBref {
  code: string
  name: string
}

export interface Fiche {
  id: string
  matricule: string
  username: string
  email: string
  phone: string | null
  last_name: string
  first_name: string
  agence_principale: AgenceBreve | null
  agences_habilitees: AgenceBreve[]
  roles: RoleBref[]
  is_active: boolean
  is_locked: boolean
  locked_until: string | null
  must_change_password: boolean
  created_at: string
  updated_at: string
}

export type EchecAction =
  | { type: 'interdit' } // 403
  | { type: 'introuvable' } // 404 — hors périmètre, ou n'existe pas
  | { type: 'conflit' } // 409 — email déjà utilisé (modification)
  | { type: 'invalide' } // 422
  | { type: 'reseau' }
  | { type: 'inattendue' }

export class ErreurAction extends Error {
  readonly echec: EchecAction

  constructor(echec: EchecAction) {
    super(echec.type)
    this.name = 'ErreurAction'
    this.echec = echec
  }
}

function traduire(erreur: unknown): EchecAction {
  if (!(erreur instanceof AxiosError)) return { type: 'inattendue' }
  if (!erreur.response) return { type: 'reseau' }
  switch (erreur.response.status) {
    case 403:
      return { type: 'interdit' }
    case 404:
      return { type: 'introuvable' }
    case 409:
      return { type: 'conflit' }
    case 422:
      return { type: 'invalide' }
    default:
      return { type: 'inattendue' }
  }
}

async function appel<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (erreur) {
    throw new ErreurAction(traduire(erreur))
  }
}

export async function chargerFiche(id: string): Promise<Fiche> {
  return appel(async () => (await api.get<Fiche>(`/users/${id}`)).data)
}

/** Champs modifiables. matricule et username en sont ABSENTS, à dessein (clés d'audit). */
export interface Modifications {
  last_name: string
  first_name: string
  email: string
  phone: string | null
}

export async function modifierFiche(id: string, modifications: Modifications): Promise<Fiche> {
  return appel(async () => (await api.patch<Fiche>(`/users/${id}`, modifications)).data)
}

export async function desactiver(id: string): Promise<Fiche> {
  return appel(async () => (await api.post<Fiche>(`/users/${id}/deactivate`)).data)
}

export async function reactiver(id: string): Promise<Fiche> {
  return appel(async () => (await api.post<Fiche>(`/users/${id}/activate`)).data)
}

export async function deverrouiller(id: string): Promise<Fiche> {
  return appel(async () => (await api.post<Fiche>(`/users/${id}/unlock`)).data)
}

export async function supprimer(id: string): Promise<void> {
  return appel(async () => {
    await api.delete(`/users/${id}`)
  })
}

/** Réinitialisation : renvoie le nouveau mot de passe provisoire (UNE fois, comme à la création). */
export async function reinitialiserMotDePasse(id: string): Promise<string> {
  return appel(
    async () =>
      (await api.post<{ mot_de_passe_provisoire: string }>(`/users/${id}/reset-password`)).data
        .mot_de_passe_provisoire,
  )
}

// --- rôles (bloc 4d) -------------------------------------------------------------------

/** Un rôle disponible, tel que GET /roles le renvoie. */
export interface RoleDisponible {
  code: string
  name: string
  description: string | null
}

export async function listerRoles(): Promise<RoleDisponible[]> {
  return appel(async () => (await api.get<RoleDisponible[]>('/roles')).data)
}

/** Attribue un rôle ; renvoie la fiche à jour (avec la nouvelle liste de rôles). */
export async function attribuerRole(id: string, roleCode: string): Promise<Fiche> {
  return appel(async () => (await api.post<Fiche>(`/users/${id}/roles`, { role_code: roleCode })).data)
}

/** Retire un rôle ; renvoie la fiche à jour. */
export async function retirerRole(id: string, roleCode: string): Promise<Fiche> {
  return appel(async () => (await api.delete<Fiche>(`/users/${id}/roles/${roleCode}`)).data)
}
