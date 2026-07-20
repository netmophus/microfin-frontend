import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  changerMotDePasse,
  ErreurMotDePasse,
  type EchecMotDePasse,
} from '@/features/auth/api'
import { REGLES } from '@/features/auth/politique'
import { schemaMotDePasse, type ChampsMotDePasse } from '@/features/auth/schema-mot-de-passe'
import { useAuth } from '@/features/auth/store'
import { tenterReprendreSession } from '@/lib/api'
import { LIBELLES } from '@/libelles/fr'

/**
 * Écran de changement de mot de passe — forcé (compte bridé) ou volontaire (depuis le
 * profil). Même formulaire, deux enveloppes.
 *
 * En mode FORCÉ, l'utilisateur y a été redirigé par RouteProtegee et ne peut aller nulle
 * part ailleurs : pas de bouton « Annuler », et un bandeau qui explique pourquoi. En mode
 * volontaire, il vient de son plein gré : retour possible.
 */

function ListeRegles({ nouveau }: { nouveau: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="mb-2 text-sm font-medium">{LIBELLES.motDePasse.exigences}</p>
      <ul className="space-y-1">
        {REGLES.map((regle) => {
          // Tant que le champ est vide, on n'affiche NI vert NI rouge : rien n'a encore été
          // saisi, marquer les règles « non satisfaites » serait accusateur sans raison.
          const vide = nouveau.length === 0
          const ok = regle.satisfaite(nouveau)
          return (
            <li
              key={regle.code}
              className={
                vide
                  ? 'flex items-center gap-2 text-sm text-muted-foreground'
                  : ok
                    ? 'flex items-center gap-2 text-sm text-emerald-700'
                    : 'flex items-center gap-2 text-sm text-muted-foreground'
              }
            >
              {vide ? (
                <span className="size-4 shrink-0" aria-hidden />
              ) : ok ? (
                <Check className="size-4 shrink-0" aria-hidden />
              ) : (
                <X className="size-4 shrink-0 text-muted-foreground/50" aria-hidden />
              )}
              <span>{LIBELLES.motDePasse.regles[regle.code]}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function MessageEchec({ echec }: { echec: EchecMotDePasse }) {
  if (echec.type === 'politique') {
    return (
      <Alert variant="destructive" role="alert">
        <AlertTitle>{LIBELLES.motDePasse.refuseParLaPolitique}</AlertTitle>
        <AlertDescription>
          <ul className="list-inside list-disc">
            {echec.violations.map((code) => (
              <li key={code}>{LIBELLES.motDePasse.regles[code]}</li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    )
  }

  const message =
    echec.type === 'actuelIncorrect'
      ? LIBELLES.motDePasse.actuelIncorrect
      : echec.type === 'dejaUtilise'
        ? LIBELLES.motDePasse.dejaUtilise
        : echec.type === 'reseau'
          ? LIBELLES.erreurs.serveurInjoignable
          : LIBELLES.erreurs.inattendue

  return (
    <Alert variant="destructive" role="alert">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

export function PageMotDePasse() {
  const naviguer = useNavigate()
  const doitChangerMotDePasse = useAuth((etat) => etat.doitChangerMotDePasse)
  const fermerSession = useAuth((etat) => etat.fermerSession)
  const [echec, setEchec] = useState<EchecMotDePasse | null>(null)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ChampsMotDePasse>({
    resolver: zodResolver(schemaMotDePasse),
    defaultValues: { actuel: '', nouveau: '', confirmation: '' },
    // Revalidation à chaque frappe une fois le premier essai fait : le retour en direct
    // n'a de sens que s'il suit la saisie.
    mode: 'onChange',
  })

  // useWatch, et non register seul : la liste des règles doit se colorer à chaque frappe.
  const nouveau = useWatch({ control, name: 'nouveau' })

  const mutation = useMutation({
    mutationFn: ({ actuel, nouveau: nv }: ChampsMotDePasse) => changerMotDePasse(actuel, nv),
    onSuccess: async () => {
      // Le changement a réussi (204). Le backend NE RÉÉMET PAS de jeton : celui en mémoire
      // porte encore must_change_password=true. On rafraîchit pour obtenir un jeton propre —
      // le refresh relit l'état en base, donc le drapeau retombe. tenterReprendreSession met
      // le store à jour avec le nouveau jeton et le drapeau à faux.
      try {
        await tenterReprendreSession()
        void naviguer('/', { replace: true, state: { message: LIBELLES.motDePasse.succes } })
      } catch {
        // Le changement a ABOUTI mais le refresh a échoué (cas rare : cookie perdu). On
        // n'annonce jamais un échec sur une opération réussie : on renvoie au login en
        // disant que le mot de passe a bien changé, et qu'il faut se reconnecter avec.
        fermerSession()
        void naviguer('/connexion', {
          replace: true,
          state: { message: LIBELLES.motDePasse.succesReconnexionRequise },
        })
      }
    },
    onError: (erreur) => {
      setEchec(erreur instanceof ErreurMotDePasse ? erreur.echec : { type: 'inattendue' })
    },
  })

  const soumettre = handleSubmit((champs) => {
    setEchec(null)
    mutation.mutate(champs)
  })

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md">
        <header className="mb-6 text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            {doitChangerMotDePasse
              ? LIBELLES.motDePasse.titreForce
              : LIBELLES.motDePasse.titreVolontaire}
          </h1>
        </header>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          {doitChangerMotDePasse && (
            <Alert className="mb-4">
              <AlertDescription>{LIBELLES.motDePasse.instructionForce}</AlertDescription>
            </Alert>
          )}

          {echec && (
            <div className="mb-4">
              <MessageEchec echec={echec} />
            </div>
          )}

          <form onSubmit={(e) => void soumettre(e)} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="actuel">{LIBELLES.motDePasse.actuel}</Label>
              <Input
                id="actuel"
                type="password"
                autoComplete="current-password"
                autoFocus
                aria-invalid={Boolean(errors.actuel)}
                {...register('actuel')}
              />
              {errors.actuel && (
                <p className="text-sm text-destructive">{errors.actuel.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nouveau">{LIBELLES.motDePasse.nouveau}</Label>
              <Input
                id="nouveau"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.nouveau)}
                {...register('nouveau')}
              />
            </div>

            <ListeRegles nouveau={nouveau ?? ''} />

            <div className="space-y-2">
              <Label htmlFor="confirmation">{LIBELLES.motDePasse.confirmation}</Label>
              <Input
                id="confirmation"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.confirmation)}
                {...register('confirmation')}
              />
              {errors.confirmation && (
                <p className="text-sm text-destructive">{errors.confirmation.message}</p>
              )}
            </div>

            <div className="flex gap-3">
              <Button type="submit" className="flex-1" disabled={mutation.isPending}>
                {mutation.isPending
                  ? LIBELLES.motDePasse.validationEnCours
                  : LIBELLES.motDePasse.valider}
              </Button>
              {/* Annuler UNIQUEMENT en mode volontaire : en mode forcé, il n'y a nulle part
                  où aller — l'échapper reviendrait à contourner l'obligation. */}
              {!doitChangerMotDePasse && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void naviguer('/', { replace: true })}
                >
                  {LIBELLES.motDePasse.annuler}
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}
