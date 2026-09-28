import { AxiosError } from 'axios'

import { api } from '@/lib/api'

/**
 * Rôles et habilitations — LOT 1 (lecture, ci-dessous) + LOT 2 (écriture, plus bas). Les
 * lectures sont gardées par la SEULE permission roles.permissions.read, jamais par
 * roles.read.
 *
 * GET /roles (roles.read) reste réservé au sélecteur de rôle de la fiche utilisateur
 * (features/utilisateurs/fiche-api.ts) — on ne le réutilise plus ici depuis l'incident du
 * 28/09/2026 : un titulaire de roles.permissions.read sans roles.read (ex. ADMIN_TECHNIQUE)
 * recevait un 403 sur cet écran alors que le menu l'y laissait entrer.
 */

export interface RoleApercu {
  code: string
  name: string
  description: string | null
  is_system: boolean
  nb_permissions: number
}

export async function listerRolesHabilitations(): Promise<RoleApercu[]> {
  const { data } = await api.get<RoleApercu[]>('/roles/habilitations')
  return data
}

export interface PermissionItem {
  code: string
  module: string
  description: string | null
}

export async function listerPermissions(): Promise<PermissionItem[]> {
  const { data } = await api.get<PermissionItem[]>('/permissions')
  return data
}

export interface RolePermissionsDetail {
  code: string
  name: string
  description: string | null
  is_system: boolean
  permissions: PermissionItem[]
}

export async function lirePermissionsRole(code: string): Promise<RolePermissionsDetail> {
  const { data } = await api.get<RolePermissionsDetail>(`/roles/${code}/permissions`)
  return data
}

// --- LOT 2 : écriture, rôles PERSONNALISÉS uniquement -------------------------------------
//
// Les 409/422 portent un message serveur déjà écrit en français, spécifique (« code déjà
// utilisé », garde-fou anti-blocage) — on l'affiche TEL QUEL plutôt que de le remplacer par
// un libellé générique : c'est le point qui donne à l'agent de quoi comprendre le refus.

export type EchecEcriture =
  | { type: 'interdit' } // 403
  | { type: 'introuvable' } // 404
  | { type: 'conflit'; message: string } // 409 — code déjà utilisé
  | { type: 'invalide'; message: string } // 422 — permission inconnue, garde-fou anti-blocage
  | { type: 'reseau' }
  | { type: 'inattendue' }

export class ErreurEcriture extends Error {
  readonly echec: EchecEcriture

  constructor(echec: EchecEcriture) {
    super(echec.type)
    this.name = 'ErreurEcriture'
    this.echec = echec
  }
}

function messageServeur(erreur: AxiosError): string {
  const detail = (erreur.response?.data as { detail?: unknown } | undefined)?.detail
  return typeof detail === 'string' ? detail : 'Action refusée.'
}

function traduireEcriture(erreur: unknown): EchecEcriture {
  if (!(erreur instanceof AxiosError)) return { type: 'inattendue' }
  if (!erreur.response) return { type: 'reseau' }
  switch (erreur.response.status) {
    case 403:
      return { type: 'interdit' }
    case 404:
      return { type: 'introuvable' }
    case 409:
      return { type: 'conflit', message: messageServeur(erreur) }
    case 422:
      return { type: 'invalide', message: messageServeur(erreur) }
    default:
      return { type: 'inattendue' }
  }
}

async function ecrire<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (erreur) {
    throw new ErreurEcriture(traduireEcriture(erreur))
  }
}

export interface NouveauRole {
  code: string
  name: string
  description: string | null
}

/** Crée un rôle PERSONNALISÉ. is_system est TOUJOURS posé à false côté serveur. */
export async function creerRole(nouveau: NouveauRole): Promise<RoleApercu> {
  return ecrire(async () => (await api.post<RoleApercu>('/roles', nouveau)).data)
}

export interface ModificationsRole {
  name?: string
  description?: string | null
}

export async function modifierRole(
  code: string,
  modifications: ModificationsRole,
): Promise<RoleApercu> {
  return ecrire(async () => (await api.patch<RoleApercu>(`/roles/${code}`, modifications)).data)
}

export async function supprimerRole(code: string): Promise<void> {
  await ecrire(async () => api.delete(`/roles/${code}`))
}

/** Remplace ATOMIQUEMENT le jeu de permissions d'un rôle personnalisé. Motif obligatoire. */
export async function remplacerPermissionsRole(
  code: string,
  permissionCodes: string[],
  motif: string,
): Promise<RolePermissionsDetail> {
  return ecrire(
    async () =>
      (
        await api.put<RolePermissionsDetail>(`/roles/${code}/permissions`, {
          permission_codes: permissionCodes,
          motif,
        })
      ).data,
  )
}
