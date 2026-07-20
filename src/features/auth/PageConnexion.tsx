import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErreurConnexion, seConnecter, type EchecConnexion } from '@/features/auth/api'
import { schemaConnexion, type ChampsConnexion } from '@/features/auth/schema'
import { useAuth } from '@/features/auth/store'
import { LIBELLES } from '@/libelles/fr'

/**
 * Écran de connexion.
 *
 * Sobre à dessein : c'est un outil de travail pour une institution financière, utilisé
 * plusieurs fois par jour. Ce qui compte est qu'on trouve les deux champs sans réfléchir et
 * que les messages d'erreur soient lisibles — pas l'originalité.
 */

/** Met en forme l'échéance d'un verrou. Le backend l'envoie en ISO 8601 avec fuseau. */
function formaterEcheance(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  // Une date invalide ne doit pas produire « Invalid Date » à l'écran : mieux vaut le
  // message sans échéance que le message avec une absurdité.
  if (Number.isNaN(date.getTime())) return null

  const aujourdhui = new Date().toDateString() === date.toDateString()
  const heure = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  if (aujourdhui) return `à ${heure}`

  const jour = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
  return `le ${jour} à ${heure}`
}

function MessageErreur({ echec }: { echec: EchecConnexion }) {
  if (echec.type === 'verrouille') {
    const echeance = formaterEcheance(echec.verrouJusqua)
    return (
      <Alert variant="destructive" role="alert">
        <AlertTitle>{LIBELLES.erreurs.compteVerrouille}</AlertTitle>
        <AlertDescription>
          {echeance
            ? LIBELLES.erreurs.compteVerrouilleDetail(echeance)
            : LIBELLES.erreurs.compteVerrouilleSansEcheance}
        </AlertDescription>
      </Alert>
    )
  }

  if (echec.type === 'motDePasseARenouveler') {
    return (
      <Alert role="alert">
        <AlertTitle>{LIBELLES.erreurs.motDePasseARenouveler}</AlertTitle>
        <AlertDescription>{LIBELLES.erreurs.motDePasseARenouvelerDetail}</AlertDescription>
      </Alert>
    )
  }

  const message =
    echec.type === 'identifiants'
      ? LIBELLES.erreurs.identifiantsIncorrects
      : echec.type === 'reseau'
        ? LIBELLES.erreurs.serveurInjoignable
        : LIBELLES.erreurs.inattendue

  return (
    <Alert variant="destructive" role="alert">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

export function PageConnexion() {
  const naviguer = useNavigate()
  const emplacement = useLocation()
  const ouvrirSession = useAuth((etat) => etat.ouvrirSession)
  const [echec, setEchec] = useState<EchecConnexion | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChampsConnexion>({
    resolver: zodResolver(schemaConnexion),
    defaultValues: { identifiant: '', motDePasse: '' },
  })

  const connexion = useMutation({
    mutationFn: ({ identifiant, motDePasse }: ChampsConnexion) =>
      seConnecter(identifiant, motDePasse),
    onSuccess: (resultat) => {
      ouvrirSession(resultat.accessToken, resultat.doitChangerMotDePasse)
      // Revenir là où l'utilisateur voulait aller avant d'être renvoyé ici.
      const destination = (emplacement.state as { depuis?: string } | null)?.depuis ?? '/'
      void naviguer(destination, { replace: true })
    },
    onError: (erreur) => {
      setEchec(erreur instanceof ErreurConnexion ? erreur.echec : { type: 'inattendue' })
    },
  })

  const soumettre = handleSubmit((champs) => {
    // L'erreur précédente disparaît dès la nouvelle tentative : la laisser afficher pendant
    // le chargement laisserait croire que le nouvel essai a échoué lui aussi.
    setEchec(null)
    connexion.mutate(champs)
  })

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <header className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{LIBELLES.application.nom}</h1>
          <p className="text-sm text-muted-foreground">{LIBELLES.application.sousTitre}</p>
        </header>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-medium">{LIBELLES.connexion.titre}</h2>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">
            {LIBELLES.connexion.instruction}
          </p>

          {echec && (
            <div className="mb-4">
              <MessageErreur echec={echec} />
            </div>
          )}

          {/* noValidate : la validation vient de zod, pas du navigateur — sinon les
              messages seraient en anglais et dépendraient du navigateur de l'agent. */}
          <form onSubmit={(evenement) => void soumettre(evenement)} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifiant">{LIBELLES.connexion.identifiant}</Label>
              <Input
                id="identifiant"
                autoComplete="username"
                autoFocus
                aria-invalid={Boolean(errors.identifiant)}
                aria-describedby={errors.identifiant ? 'erreur-identifiant' : undefined}
                {...register('identifiant')}
              />
              {errors.identifiant && (
                <p id="erreur-identifiant" className="text-sm text-destructive">
                  {errors.identifiant.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="motDePasse">{LIBELLES.connexion.motDePasse}</Label>
              <Input
                id="motDePasse"
                type="password"
                autoComplete="current-password"
                aria-invalid={Boolean(errors.motDePasse)}
                aria-describedby={errors.motDePasse ? 'erreur-mot-de-passe' : undefined}
                {...register('motDePasse')}
              />
              {errors.motDePasse && (
                <p id="erreur-mot-de-passe" className="text-sm text-destructive">
                  {errors.motDePasse.message}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={connexion.isPending}>
              {connexion.isPending
                ? LIBELLES.connexion.validationEnCours
                : LIBELLES.connexion.valider}
            </Button>
          </form>
        </div>
      </div>
    </main>
  )
}
