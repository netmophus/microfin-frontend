import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { seDeconnecter } from '@/features/auth/api'
import { useAuth } from '@/features/auth/store'
import { LIBELLES } from '@/libelles/fr'

/**
 * Écran d'attente derrière la route protégée.
 *
 * Volontairement minimal : il ne préfigure pas le tableau de bord, il PROUVE que le
 * parcours fonctionne — la route protégée laisse passer, le jeton est en mémoire, la
 * déconnexion révoque la session côté serveur.
 *
 * Il affiche aussi l'avertissement de renouvellement de mot de passe, parce qu'un compte
 * dans cet état se verrait refuser toute action ensuite : mieux vaut le lui dire ici que le
 * laisser buter sur des 403 sans comprendre.
 */
export function PageAccueil() {
  const naviguer = useNavigate()
  const fermerSession = useAuth((etat) => etat.fermerSession)
  const doitChangerMotDePasse = useAuth((etat) => etat.doitChangerMotDePasse)

  const deconnecter = async () => {
    await seDeconnecter()
    fermerSession()
    void naviguer('/connexion', { replace: true })
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{LIBELLES.accueil.titre}</h1>
        <p className="mt-1 text-muted-foreground">{LIBELLES.accueil.bienvenue}</p>
      </div>

      {doitChangerMotDePasse && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">{LIBELLES.erreurs.motDePasseARenouveler}</p>
          <p>{LIBELLES.erreurs.motDePasseARenouvelerDetail}</p>
        </div>
      )}

      <p className="text-sm text-muted-foreground">{LIBELLES.accueil.provisoire}</p>

      <div>
        <Button variant="outline" onClick={() => void deconnecter()}>
          {LIBELLES.session.deconnexion}
        </Button>
      </div>
    </main>
  )
}
