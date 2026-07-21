import { LogOut } from 'lucide-react'
import { Outlet, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { seDeconnecter } from '@/features/auth/api'
import { useAuth } from '@/features/auth/store'
import { LIBELLES } from '@/libelles/fr'

/**
 * Mise en page des écrans authentifiés : barre de navigation + contenu.
 *
 * Route de mise en page (rend <Outlet />) : la barre est écrite UNE fois et surplombe tous
 * les écrans protégés à venir, sans être recopiée dans chacun.
 *
 * L'identifiant affiché vient du store, posé à la connexion (cf. store.ts) : présent en
 * usage normal, absent après un rechargement de page. On ne l'affiche donc que s'il existe,
 * plutôt que d'imposer un « — » qui interrogerait l'utilisateur.
 */
export function AppLayout() {
  const naviguer = useNavigate()
  const identifiant = useAuth((etat) => etat.identifiant)
  const fermerSession = useAuth((etat) => etat.fermerSession)

  const deconnecter = async () => {
    await seDeconnecter()
    fermerSession()
    void naviguer('/connexion', { replace: true })
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold tracking-tight">{LIBELLES.application.nom}</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {LIBELLES.application.sousTitre}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {identifiant && (
              <span className="text-sm text-muted-foreground">
                {LIBELLES.navigation.utilisateurLabel} : {identifiant}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => void deconnecter()}>
              <LogOut className="mr-1.5 size-4" aria-hidden />
              {LIBELLES.navigation.deconnexion}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
