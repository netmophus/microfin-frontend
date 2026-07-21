import { useQuery } from '@tanstack/react-query'

import { chargerProfil } from '@/features/auth/profil'

/**
 * Profil de l'utilisateur connecté, partagé.
 *
 * Une seule clé de cache ['profil'] : la barre, le menu et les boutons conditionnés à une
 * permission lisent le MÊME résultat. TanStack Query dédoublonne — un seul GET /auth/me,
 * quels que soient les composants qui le demandent.
 */
export function useProfil() {
  return useQuery({ queryKey: ['profil'], queryFn: chargerProfil })
}

/** Vrai si l'utilisateur détient la permission. Faux tant que le profil n'est pas chargé. */
export function useAPermission(permission: string): boolean {
  const profil = useProfil()
  return profil.data?.permissions.includes(permission) ?? false
}
