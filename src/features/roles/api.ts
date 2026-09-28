import { api } from '@/lib/api'

/**
 * Rôles et habilitations — LOT 1, lecture seule. Écran AUTONOME : ses trois appels sont
 * gardés par la SEULE permission roles.permissions.read, jamais par roles.read.
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
