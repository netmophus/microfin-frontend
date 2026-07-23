import { Navigate } from 'react-router-dom'

import { nomAffiche } from '@/features/auth/profil'
import { useProfil } from '@/features/auth/useProfil'
import { LIBELLES } from '@/libelles/fr'

/**
 * Accueil — le point d'arrivée après connexion, qui DISPATCHE selon les droits.
 *
 * Pourquoi ce n'est pas la liste des utilisateurs par défaut : un compte sans users.read y
 * verrait « vous n'avez pas la permission » en rouge dès la connexion, alors qu'il n'a rien
 * demandé. Un employé croirait le logiciel cassé.
 *
 * Ici, au contraire :
 *   - qui peut consulter les utilisateurs est envoyé directement à la liste ;
 *   - qui ne le peut pas arrive sur un mot d'accueil CALME, adapté à sa situation — pas une
 *     erreur. Le cas le plus important est le compte tout neuf, sans rôle : on lui explique
 *     posément qu'il attend ses accès, on ne lui jette pas un refus.
 */
export function PageAccueil() {
  const profil = useProfil()

  if (profil.isPending) {
    return <p className="py-8 text-sm text-muted-foreground">{LIBELLES.chargement}</p>
  }

  // La redirection après connexion tient compte de ce à quoi la personne a droit. Ordre :
  // l'administration d'abord (users.read), puis le métier (tiers). Un caissier, sans
  // users.read mais avec l'accès aux tiers, atterrit ainsi sur SON écran, pas sur un mot
  // d'accueil « aucun écran » trompeur.
  const permissions = profil.data?.permissions ?? []
  if (permissions.includes('users.read')) {
    return <Navigate to="/utilisateurs" replace />
  }
  if (permissions.includes('tiers.read.basic')) {
    return <Navigate to="/tiers" replace />
  }

  const nom = profil.data ? nomAffiche(profil.data) : ''
  const sansRole = (profil.data?.roles.length ?? 0) === 0

  return (
    <div className="mx-auto max-w-lg space-y-3 py-8">
      <h1 className="text-xl font-semibold tracking-tight">{LIBELLES.accueil.bienvenue(nom)}</h1>
      <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
        {sansRole ? LIBELLES.accueil.sansRole : LIBELLES.accueil.aucunEcran}
      </div>
    </div>
  )
}
