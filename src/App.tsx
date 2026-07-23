import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useRef, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { PageConnexion } from '@/features/auth/PageConnexion'
import { PageMotDePasse } from '@/features/auth/PageMotDePasse'
import { RouteAuthentifiee } from '@/features/auth/RouteAuthentifiee'
import { RoutePermission } from '@/features/auth/RoutePermission'
import { RouteProtegee } from '@/features/auth/RouteProtegee'
import { AppLayout } from '@/features/layout/AppLayout'
import { PageAccueil } from '@/features/accueil/PageAccueil'
import { PageJournalAudit } from '@/features/audit/PageJournalAudit'
import { PageCreationTier } from '@/features/tiers/PageCreationTier'
import { PageFicheTier } from '@/features/tiers/PageFicheTier'
import { PageTiers } from '@/features/tiers/PageTiers'
import { PageCreationUtilisateur } from '@/features/utilisateurs/PageCreationUtilisateur'
import { PageFicheUtilisateur } from '@/features/utilisateurs/PageFicheUtilisateur'
import { PageUtilisateurs } from '@/features/utilisateurs/PageUtilisateurs'
import { tenterReprendreSession } from '@/lib/api'

/** Racine de l'application : providers, amorçage de session, routage. */

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Une requête qui échoue en 401 est déjà rejouée par l'intercepteur après refresh.
      // Laisser TanStack Query réessayer par-dessus multiplierait les appels sans rien
      // résoudre, et brouillerait le diagnostic quand une erreur est réelle.
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
})

/**
 * Tente de reprendre la session au démarrage, une seule fois.
 *
 * L'access token vit en mémoire et disparaît à chaque rechargement ; le cookie de refresh,
 * lui, survit. Sans cette tentative, un F5 renverrait au formulaire de connexion — dix fois
 * par jour pour un agent de guichet.
 *
 * `useRef` plutôt que le seul tableau de dépendances vide : en mode strict, React monte puis
 * démonte puis remonte chaque composant en développement, et l'effet partirait deux fois. Le
 * single-flight de l'intercepteur le rattraperait, mais mieux vaut ne pas émettre l'appel en
 * double que de compter sur un filet.
 */
function AmorcageSession({ children }: { children: ReactNode }) {
  const dejaTente = useRef(false)

  useEffect(() => {
    if (dejaTente.current) return
    dejaTente.current = true
    void tenterReprendreSession()
  }, [])

  return <>{children}</>
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AmorcageSession>
          <Routes>
            <Route path="/connexion" element={<PageConnexion />} />
            {/* Authentifié suffit — miroir de exige_authentification() : un compte bridé
                doit pouvoir atteindre CET écran, et seulement celui-ci. */}
            <Route
              path="/changer-mot-de-passe"
              element={
                <RouteAuthentifiee>
                  <PageMotDePasse />
                </RouteAuthentifiee>
              }
            />
            {/* Route de MISE EN PAGE : la garde protège, AppLayout habille (barre de
                navigation + <Outlet/>), et les écrans authentifiés se déclarent dessous.
                Chaque écran à venir s'ajoute ici sans retoucher la barre ni la garde. */}
            <Route
              element={
                <RouteProtegee>
                  <AppLayout />
                </RouteProtegee>
              }
            >
              {/* / = accueil qui DISPATCHE selon les droits (liste si users.read, sinon un
                  mot d'accueil neutre). La liste des utilisateurs vit sous /utilisateurs.
                  CHAQUE écran conditionné à une permission est gardé au ROUTAGE par
                  RoutePermission : sans le droit, on est redirigé vers l'accueil — jamais
                  d'erreur rouge sur une URL mémorisée. */}
              <Route path="/" element={<PageAccueil />} />
              <Route
                path="/utilisateurs"
                element={
                  <RoutePermission permission="users.read">
                    <PageUtilisateurs />
                  </RoutePermission>
                }
              />
              {/* /nouveau AVANT /:id : sinon « nouveau » serait pris pour un identifiant. */}
              <Route
                path="/utilisateurs/nouveau"
                element={
                  <RoutePermission permission="users.create">
                    <PageCreationUtilisateur />
                  </RoutePermission>
                }
              />
              <Route
                path="/utilisateurs/:id"
                element={
                  <RoutePermission permission="users.read">
                    <PageFicheUtilisateur />
                  </RoutePermission>
                }
              />
              <Route
                path="/audit"
                element={
                  <RoutePermission permission="audit.read">
                    <PageJournalAudit />
                  </RoutePermission>
                }
              />
              {/* /nouveau AVANT /:id : sinon « nouveau » serait pris pour un identifiant. */}
              <Route
                path="/tiers"
                element={
                  <RoutePermission permission="tiers.read.basic">
                    <PageTiers />
                  </RoutePermission>
                }
              />
              <Route
                path="/tiers/nouveau"
                element={
                  <RoutePermission permission="tiers.create">
                    <PageCreationTier />
                  </RoutePermission>
                }
              />
              <Route
                path="/tiers/:id"
                element={
                  <RoutePermission permission="tiers.read.basic">
                    <PageFicheTier />
                  </RoutePermission>
                }
              />
            </Route>
            {/* Toute autre adresse ramène à l'accueil, qui décidera lui-même s'il faut
                d'abord passer par la connexion. */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AmorcageSession>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
