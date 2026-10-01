import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  type ApercuCloture,
  type ClotureExerciceResultat,
  type ExerciceResume,
  cloturerExercice,
  listerExercices,
  messageRefusCompte,
  previsualiserCloture,
} from '@/features/comptabilite/api'
import { formatFcfa } from '@/features/epargne/api'
import { LIBELLES } from '@/libelles/fr'

const X = LIBELLES.exercicesComptables

const CLE_LISTE = ['comptabilite', 'exercices']

function fmt(gabarit: string, valeurs: Record<string, string>): string {
  return gabarit.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '')
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR')
}

/**
 * Clôture TECHNIQUE d'un exercice (chantier P1, lot b1) : solde les comptes de charges/produits
 * (classe 6/7) vers 591 (résultat en instance d'approbation), puis bascule l'exercice à 'clos'.
 * DÉFINITIVE — aucune réouverture. L'affectation du résultat (591 -> 592/58) est un lot séparé
 * (b2), pas encore disponible : cet écran s'arrête à 591.
 */
export function PageExercices() {
  const [exerciceOuvert, setExerciceOuvert] = useState<ExerciceResume | null>(null)

  const requete = useQuery({ queryKey: CLE_LISTE, queryFn: listerExercices })

  if (exerciceOuvert) {
    return (
      <PanneauCloture
        exercice={exerciceOuvert}
        onRetour={() => setExerciceOuvert(null)}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{X.titre}</h1>
        <p className="text-sm text-muted-foreground">{X.sousTitre}</p>
      </div>

      {requete.isPending ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{X.chargement}</p>
      ) : requete.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription className="space-y-2">
            <p>{X.erreur}</p>
            <Button size="sm" variant="outline" onClick={() => void requete.refetch()}>
              {X.reessayer}
            </Button>
          </AlertDescription>
        </Alert>
      ) : requete.data.length === 0 ? (
        <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
          {X.listeVide}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{X.colCode}</th>
                <th className="px-3 py-2 text-left font-medium">{X.colLibelle}</th>
                <th className="px-3 py-2 text-left font-medium">{X.colPeriode}</th>
                <th className="px-3 py-2 text-left font-medium">{X.colStatut}</th>
                <th className="px-3 py-2" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {requete.data.map((exercice) => (
                <tr key={exercice.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{exercice.code}</td>
                  <td className="px-3 py-2">{exercice.label}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatDate(exercice.date_debut)} – {formatDate(exercice.date_fin)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge ton={exercice.status === 'ouvert' ? 'success' : 'neutral'}>
                      {exercice.status === 'ouvert' ? X.statutOuvert : X.statutClos}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {exercice.status === 'ouvert' && (
                      <Button size="sm" variant="outline" onClick={() => setExerciceOuvert(exercice)}>
                        {X.cloturer}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function PanneauCloture({
  exercice,
  onRetour,
}: {
  exercice: ExerciceResume
  onRetour: () => void
}) {
  const client = useQueryClient()
  const [confirmation, setConfirmation] = useState(false)
  const [resultat, setResultat] = useState<ClotureExerciceResultat | null>(null)

  const apercuRequete = useQuery({
    queryKey: ['comptabilite', 'exercices', exercice.id, 'apercu-cloture'],
    queryFn: () => previsualiserCloture(exercice.id),
    enabled: resultat === null,
  })

  const execution = useMutation({
    mutationFn: () => cloturerExercice(exercice.id),
    onSuccess: (data) => {
      setResultat(data)
      setConfirmation(false)
      void client.invalidateQueries({ queryKey: CLE_LISTE })
    },
  })

  const apercu = apercuRequete.data ?? null

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {fmt(X.apercuTitre, { code: exercice.code })}
        </h1>
      </div>

      {resultat === null && apercuRequete.isPending && (
        <p className="py-8 text-center text-sm text-muted-foreground">{X.apercuChargement}</p>
      )}

      {resultat === null && apercuRequete.isError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription className="space-y-2">
            <p>{X.apercuErreur}</p>
            <Button size="sm" variant="outline" onClick={() => void apercuRequete.refetch()}>
              {X.reessayer}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {resultat === null && apercu && !confirmation && (
        <section className="space-y-4 rounded-md border p-4">
          <ResultatBadge resultat={apercu.resultat} compteResultat={apercu.compte_resultat} />

          {apercu.lignes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{X.rienACloturer}</p>
          ) : (
            <TableauDetail apercu={apercu} />
          )}

          {apercu.brouillons_bloquants.length > 0 && (
            <div role="alert" className="space-y-2 rounded-md border border-danger/50 bg-danger-subtle/40 p-3">
              <p className="text-sm font-medium">{X.brouillonsTitre}</p>
              <p className="text-sm">
                {fmt(X.brouillonsTexte, { n: String(apercu.brouillons_bloquants.length) })}
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-1 pr-2 font-medium">{X.colBrouillonJournal}</th>
                    <th className="py-1 pr-2 font-medium">{X.colBrouillonDate}</th>
                    <th className="py-1 font-medium">{X.colBrouillonDescription}</th>
                  </tr>
                </thead>
                <tbody>
                  {apercu.brouillons_bloquants.map((b) => (
                    <tr key={b.entry_id}>
                      <td className="py-1 pr-2 font-mono text-xs">{b.journal_code}</td>
                      <td className="py-1 pr-2 whitespace-nowrap">{formatDate(b.entry_date)}</td>
                      <td className="py-1">{b.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-2">
            {apercu.cloturable && (
              <Button onClick={() => setConfirmation(true)}>{X.cloturer}</Button>
            )}
            <Button variant="ghost" onClick={onRetour}>
              {X.retour}
            </Button>
          </div>
        </section>
      )}

      {apercu && confirmation && (
        <section className="space-y-3 rounded-md border border-warning/50 bg-warning-subtle/40 p-4">
          <p className="font-medium">{fmt(X.confirmerCloture, { code: exercice.code })}</p>
          {execution.isError && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{messageRefusCompte(execution.error, X.echec)}</AlertDescription>
            </Alert>
          )}
          <div className="flex gap-2">
            <Button onClick={() => execution.mutate()} disabled={execution.isPending}>
              {execution.isPending ? X.clotureEnCours : X.confirmerClotureBouton}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmation(false)} disabled={execution.isPending}>
              {X.annuler}
            </Button>
          </div>
        </section>
      )}

      {resultat && (
        <Alert role="status">
          <AlertDescription className="space-y-3">
            <p className="font-medium">
              {fmt(X.clotureReussie, { code: exercice.code, numero: resultat.entry_number })}
            </p>
            <Button size="sm" variant="ghost" onClick={onRetour}>
              {X.retour}
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

function ResultatBadge({
  resultat,
  compteResultat,
}: {
  resultat: number
  compteResultat: string
}) {
  if (resultat === 0) {
    return <p className="text-sm font-medium text-muted-foreground">{X.resultatNul}</p>
  }
  const excedent = resultat > 0
  return (
    <div className="space-y-1">
      <Badge ton={excedent ? 'success' : 'danger'}>
        {fmt(excedent ? X.resultatExcedent : X.resultatDeficit, {
          montant: formatFcfa(Math.abs(resultat)),
        })}
      </Badge>
      <p className="text-xs text-muted-foreground">
        {fmt(X.compteResultatMention, { compte: compteResultat })}
      </p>
    </div>
  )
}

function TableauDetail({ apercu }: { apercu: ApercuCloture }) {
  return (
    <div className="overflow-x-auto">
      <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{X.detailTitre}</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-1 pr-2 font-medium">{X.colDetailCompte}</th>
            <th className="py-1 pr-2 font-medium">{X.colDetailLibelle}</th>
            <th className="py-1 pr-2 text-right font-medium">{X.colDetailDebit}</th>
            <th className="py-1 pr-2 text-right font-medium">{X.colDetailCredit}</th>
            <th className="py-1 text-right font-medium">{X.colDetailRegularisation}</th>
          </tr>
        </thead>
        <tbody>
          {apercu.lignes.map((ligne) => (
            <tr key={ligne.account_number} className="border-b last:border-0">
              <td className="py-1 pr-2 font-mono text-xs">{ligne.account_number}</td>
              <td className="py-1 pr-2">{ligne.name}</td>
              <td className="py-1 pr-2 text-right tabular-nums">{formatFcfa(ligne.total_debit)}</td>
              <td className="py-1 pr-2 text-right tabular-nums">{formatFcfa(ligne.total_credit)}</td>
              <td className="py-1 text-right text-xs tabular-nums">
                {ligne.side === 'D' ? X.sensDebit : X.sensCredit} {formatFcfa(ligne.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
