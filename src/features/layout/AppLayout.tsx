import { useQuery } from '@tanstack/react-query'
import { KeyRound, LogOut } from 'lucide-react'
import { Link, Outlet, useNavigate } from 'react-router-dom'

import { Button, buttonVariants } from '@/components/ui/button'
import { seDeconnecter } from '@/features/auth/api'
import { chargerProfil, nomAffiche } from '@/features/auth/profil'
import { useAuth } from '@/features/auth/store'
import { BarreLaterale } from '@/features/navigation/BarreLaterale'
import { LIBELLES } from '@/libelles/fr'

/**
 * Mise en page des écrans authentifiés : barre du haut + arborescence à gauche + zone de
 * travail. Route de mise en page (rend <Outlet />) — écrite une fois, elle surplombe tous
 * les écrans à venir.
 *
 * Le PROFIL vient de GET /auth/me, pas du store : il se re-demande à chaque montage, donc le
 * nom et le menu SURVIVENT au rechargement de page, là où le jeton en mémoire, lui, se perd.
 */
export function AppLayout() {
  const naviguer = useNavigate()
  const fermerSession = useAuth((etat) => etat.fermerSession)
  const identifiantSecours = useAuth((etat) => etat.identifiant)

  const profil = useQuery({ queryKey: ['profil'], queryFn: chargerProfil })

  const deconnecter = async () => {
    await seDeconnecter()
    fermerSession()
    void naviguer('/connexion', { replace: true })
  }

  // Nom du profil s'il est chargé ; sinon l'identifiant de session, le temps du chargement.
  const nom = profil.data ? nomAffiche(profil.data) : identifiantSecours
  const permissions = profil.data?.permissions ?? []
  // La QUALITÉ (rôle·s) et l'agence courante, sous le nom : dans une IMF où l'on peut changer
  // de fonction ou avoir plusieurs comptes, savoir « en quelle qualité » on est connecté évite
  // les erreurs de manipulation. L'agence servira quand le multi-agences arrivera.
  const roles = (profil.data?.roles ?? []).map((r) => r.name).join(', ')
  const agence = profil.data?.agence_courante?.name ?? null

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="border-b bg-background">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold tracking-tight">{LIBELLES.application.nom}</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {LIBELLES.application.sousTitre}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {nom && (
              <div className="text-right leading-tight">
                <div className="text-sm text-muted-foreground">
                  {LIBELLES.navigation.utilisateurLabel} :{' '}
                  <span className="font-medium text-foreground">{nom}</span>
                </div>
                {(roles || agence) && (
                  <div className="text-xs text-muted-foreground">
                    {roles}
                    {roles && agence ? ' · ' : ''}
                    {agence}
                  </div>
                )}
              </div>
            )}
            {/* Changer SON mot de passe : la réinitialisation par un admin est interdite sur
                soi-même, cette voie self-service est donc la seule pour son propre compte. */}
            <Link
              to="/changer-mot-de-passe"
              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
              title={LIBELLES.navigation.changerMotDePasse}
            >
              <KeyRound className="mr-1.5 size-4" aria-hidden />
              {LIBELLES.navigation.changerMotDePasse}
            </Link>
            <Button variant="outline" size="sm" onClick={() => void deconnecter()}>
              <LogOut className="mr-1.5 size-4" aria-hidden />
              {LIBELLES.navigation.deconnexion}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <BarreLaterale permissions={permissions} />
        <main className="min-w-0 flex-1 px-6 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
