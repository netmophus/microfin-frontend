import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { useProfil } from '@/features/auth/useProfil'
import { LIBELLES } from '@/libelles/fr'

/**
 * Garde de route par PERMISSION — le pendant de RouteProtegee (qui, lui, ne garde que
 * l'authentification).
 *
 * CE N'EST PAS UNE MESURE DE SÉCURITÉ : le backend reste l'autorité, il refuse la donnée en
 * 403 quoi qu'il arrive. C'est du CONFORT, et il corrige un défaut réel : sans elle, taper (ou
 * revenir sur, via une URL mémorisée) l'adresse d'un écran qu'on n'a pas le droit de voir fait
 * ATTERRIR dessus, où l'appel API renvoie un 403 affiché en ROUGE — sur une page qu'on n'a pas
 * demandée. Un administrateur qui retombe sur /tiers après reconnexion croirait à une panne.
 *
 * On REDIRIGE vers l'accueil, qui dispatche calmement selon les droits (comme pour un compte
 * sans rôle) — jamais une erreur sur un écran non sollicité.
 *
 * ATTENDRE LE PROFIL est essentiel : pendant son chargement, la permission paraît « absente »
 * et rediriger alors renverrait à tort quelqu'un qui a pourtant le droit. Même précaution que
 * l'attente de l'amorçage dans RouteProtegee.
 */
export function RoutePermission({
  permission,
  children,
}: {
  permission: string
  children: ReactNode
}) {
  const profil = useProfil()

  if (profil.isPending) {
    return <p className="py-8 text-sm text-muted-foreground">{LIBELLES.chargement}</p>
  }

  if (!profil.data?.permissions.includes(permission)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
