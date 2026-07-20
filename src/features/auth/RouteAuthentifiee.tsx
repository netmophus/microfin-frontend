import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '@/features/auth/store'
import { LIBELLES } from '@/libelles/fr'

/**
 * Garde de route « il suffit d'être authentifié ».
 *
 * MIROIR de exige_authentification() côté backend, comme RouteProtegee est le miroir de
 * exige(). La différence entre les deux est exactement celle qui compte pour cet écran :
 *
 *   - RouteProtegee exige un jeton ET l'absence du drapeau de renouvellement. Un compte
 *     bridé y est renvoyé vers l'écran de changement.
 *   - RouteAuthentifiee (celle-ci) exige seulement un jeton. C'est ce qui laisse l'écran de
 *     changement joignable à un compte bridé — sans quoi il serait enfermé dehors, incapable
 *     de faire précisément ce qu'on exige de lui.
 *
 * Reproduire la distinction du backend côté client garantit qu'ils ne divergent pas : le
 * serveur reste l'autorité (il refuse en 403 quoi qu'affiche le front), mais l'expérience
 * n'a pas à passer par une cascade de refus pour être correcte.
 */
export function RouteAuthentifiee({ children }: { children: ReactNode }) {
  const accessToken = useAuth((etat) => etat.accessToken)
  const amorcage = useAuth((etat) => etat.amorcage)
  const emplacement = useLocation()

  if (amorcage === 'en_cours') {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        {LIBELLES.chargement}
      </div>
    )
  }

  if (!accessToken) {
    return <Navigate to="/connexion" replace state={{ depuis: emplacement.pathname }} />
  }

  return <>{children}</>
}
