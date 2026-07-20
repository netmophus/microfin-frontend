import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '@/features/auth/store'
import { LIBELLES } from '@/libelles/fr'

/**
 * Garde de route côté client.
 *
 * CE N'EST PAS UNE MESURE DE SÉCURITÉ, et il faut le dire clairement : tout ce qui est
 * décidé dans le navigateur est contournable. La vraie protection est le 401/403 du
 * backend, qui refuse la donnée quoi qu'il arrive. Ce composant sert le CONFORT — éviter
 * d'afficher un écran vide qui se remplirait d'erreurs.
 *
 * ATTENDRE L'AMORÇAGE EST ESSENTIEL. L'access token vit en mémoire : au rechargement de la
 * page il est nul, le temps que le refresh silencieux aboutisse. Sans l'état `en_cours`, ce
 * composant conclurait « pas de session » et redirigerait vers la connexion — chaque F5
 * déconnecterait l'utilisateur alors que son cookie est parfaitement valide.
 */
export function RouteProtegee({ children }: { children: ReactNode }) {
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
    // `depuis` permet de revenir à la page demandée après connexion, plutôt que de
    // retomber systématiquement sur l'accueil.
    return <Navigate to="/connexion" replace state={{ depuis: emplacement.pathname }} />
  }

  return <>{children}</>
}
