import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useRef, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { PageAccueil } from '@/features/accueil/PageAccueil'
import { PageConnexion } from '@/features/auth/PageConnexion'
import { PageMotDePasse } from '@/features/auth/PageMotDePasse'
import { RouteAuthentifiee } from '@/features/auth/RouteAuthentifiee'
import { RouteProtegee } from '@/features/auth/RouteProtegee'
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
            <Route
              path="/"
              element={
                <RouteProtegee>
                  <PageAccueil />
                </RouteProtegee>
              }
            />
            {/* Toute autre adresse ramène à l'accueil, qui décidera lui-même s'il faut
                d'abord passer par la connexion. */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AmorcageSession>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
