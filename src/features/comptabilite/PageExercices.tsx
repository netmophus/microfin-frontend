import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  type AffectationResultatResultat,
  type ANouveauxResultat,
  type ApercuANouveaux,
  type ApercuCloture,
  type ClotureExerciceResultat,
  type ExerciceResume,
  type VentilationAffectation,
  affecterResultat,
  cloturerExercice,
  genererANouveaux,
  listerExercices,
  messageRefusCompte,
  previsualiserAffectation,
  previsualiserANouveaux,
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

function montantSaisi(brut: string): number {
  return Number.parseInt(brut.replace(/\D/g, ''), 10) || 0
}

/**
 * Clôture TECHNIQUE d'un exercice (chantier P1, lot b1) : solde les comptes de charges/produits
 * (classe 6/7) vers 591 (résultat en instance d'approbation), puis bascule l'exercice à 'clos'.
 * DÉFINITIVE — aucune réouverture. Affectation du résultat (lot b2a) : une fois clos, 591 se
 * solde vers les réserves et/ou le report à nouveau (58) — jamais 592 (décision actée).
 * À-nouveaux (lot b2b) : reprend les soldes de clôture des comptes de BILAN (classes 1-5, 591
 * compris) comme soldes d'ouverture de l'exercice suivant, journal AN — INDÉPENDANT de
 * l'affectation (591 se reporte tel quel, affecté ou non).
 */
export function PageExercices() {
  const [exerciceOuvert, setExerciceOuvert] = useState<ExerciceResume | null>(null)
  const [exerciceAAffecter, setExerciceAAffecter] = useState<ExerciceResume | null>(null)
  const [exerciceANouveaux, setExerciceANouveaux] = useState<ExerciceResume | null>(null)

  const requete = useQuery({ queryKey: CLE_LISTE, queryFn: listerExercices })

  if (exerciceOuvert) {
    return (
      <PanneauCloture
        exercice={exerciceOuvert}
        onRetour={() => setExerciceOuvert(null)}
      />
    )
  }

  if (exerciceAAffecter) {
    return (
      <PanneauAffectation
        exercice={exerciceAAffecter}
        onRetour={() => setExerciceAAffecter(null)}
      />
    )
  }

  if (exerciceANouveaux) {
    return (
      <PanneauANouveaux
        exercice={exerciceANouveaux}
        onRetour={() => setExerciceANouveaux(null)}
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
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge ton={exercice.status === 'ouvert' ? 'success' : 'neutral'}>
                        {exercice.status === 'ouvert' ? X.statutOuvert : X.statutClos}
                      </Badge>
                      {exercice.status === 'clos' && exercice.resultat_affecte && (
                        <Badge ton="success">{X.resultatAffecteBadge}</Badge>
                      )}
                      {exercice.status === 'clos' && exercice.a_nouveaux_generes && (
                        <Badge ton="success">{X.aNouveauxGeneresBadge}</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {exercice.status === 'ouvert' && (
                        <Button size="sm" variant="outline" onClick={() => setExerciceOuvert(exercice)}>
                          {X.cloturer}
                        </Button>
                      )}
                      {exercice.status === 'clos' && !exercice.resultat_affecte && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setExerciceAAffecter(exercice)}
                        >
                          {X.affecterResultat}
                        </Button>
                      )}
                      {exercice.status === 'clos' && !exercice.a_nouveaux_generes && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setExerciceANouveaux(exercice)}
                        >
                          {X.genererANouveaux}
                        </Button>
                      )}
                    </div>
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

/**
 * Affectation du résultat (lot b2a) : 591 -> réserves (5521/5522/5523) et/ou report à nouveau
 * (58), JAMAIS 592 (décision actée, voir affectation_resultat.py). Sur un DÉFICIT, aucun champ
 * de ventilation n'est proposé — le serveur l'exigerait de toute façon intégralement en report
 * à nouveau, inutile de faire saisir ce qui n'a qu'une seule réponse possible.
 */
function PanneauAffectation({
  exercice,
  onRetour,
}: {
  exercice: ExerciceResume
  onRetour: () => void
}) {
  const client = useQueryClient()
  const [confirmation, setConfirmation] = useState(false)
  const [reserveGenerale, setReserveGenerale] = useState('')
  const [reservesFacultatives, setReservesFacultatives] = useState('')
  const [autresReserves, setAutresReserves] = useState('')
  const [reportANouveau, setReportANouveau] = useState('')
  const [resultat, setResultat] = useState<AffectationResultatResultat | null>(null)

  const apercuRequete = useQuery({
    queryKey: ['comptabilite', 'exercices', exercice.id, 'apercu-affectation'],
    queryFn: () => previsualiserAffectation(exercice.id),
    enabled: resultat === null,
  })

  const execution = useMutation({
    mutationFn: (ventilation: VentilationAffectation) =>
      affecterResultat(exercice.id, ventilation),
    onSuccess: (data) => {
      setResultat(data)
      setConfirmation(false)
      void client.invalidateQueries({ queryKey: CLE_LISTE })
    },
  })

  const apercu = apercuRequete.data ?? null
  const montant = apercu?.montant ?? 0
  const estDeficit = montant < 0
  const totalVentile = estDeficit
    ? -montant
    : montantSaisi(reserveGenerale) +
      montantSaisi(reservesFacultatives) +
      montantSaisi(autresReserves) +
      montantSaisi(reportANouveau)
  const ventilationValide = estDeficit || totalVentile === montant

  function ventilationActuelle(): VentilationAffectation {
    if (estDeficit) {
      return {
        reserve_generale: 0,
        reserves_facultatives: 0,
        autres_reserves: 0,
        report_a_nouveau: -montant,
      }
    }
    return {
      reserve_generale: montantSaisi(reserveGenerale),
      reserves_facultatives: montantSaisi(reservesFacultatives),
      autres_reserves: montantSaisi(autresReserves),
      report_a_nouveau: montantSaisi(reportANouveau),
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {fmt(X.apercuAffectationTitre, { code: exercice.code })}
        </h1>
      </div>

      {resultat === null && apercuRequete.isPending && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {X.apercuAffectationChargement}
        </p>
      )}

      {resultat === null && apercuRequete.isError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription className="space-y-2">
            <p>{X.apercuAffectationErreur}</p>
            <Button size="sm" variant="outline" onClick={() => void apercuRequete.refetch()}>
              {X.reessayer}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {resultat === null && apercu?.deja_affecte && (
        <Alert role="status">
          <AlertDescription className="space-y-3">
            <p>{X.dejaAffecte}</p>
            <Button size="sm" variant="ghost" onClick={onRetour}>
              {X.retour}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {resultat === null && apercu && !apercu.deja_affecte && apercu.montant === null && (
        <Alert role="status">
          <AlertDescription className="space-y-3">
            <p>{X.rienAAffecter}</p>
            <Button size="sm" variant="ghost" onClick={onRetour}>
              {X.retour}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {resultat === null &&
        apercu &&
        !apercu.deja_affecte &&
        apercu.montant !== null &&
        !confirmation && (
          <section className="space-y-4 rounded-md border p-4">
            <Badge ton={estDeficit ? 'danger' : 'success'}>
              {fmt(estDeficit ? X.affectationDeficit : X.affectationExcedent, {
                montant: formatFcfa(Math.abs(montant)),
              })}
            </Badge>

            {estDeficit ? (
              <p className="text-sm">
                {fmt(X.deficitReporteIntegralement, { montant: formatFcfa(-montant) })}
              </p>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <ChampVentilation
                    id="aff-5521"
                    label={X.champReserveGenerale}
                    valeur={reserveGenerale}
                    onChange={setReserveGenerale}
                  />
                  <ChampVentilation
                    id="aff-5522"
                    label={X.champReservesFacultatives}
                    valeur={reservesFacultatives}
                    onChange={setReservesFacultatives}
                  />
                  <ChampVentilation
                    id="aff-5523"
                    label={X.champAutresReserves}
                    valeur={autresReserves}
                    onChange={setAutresReserves}
                  />
                  <ChampVentilation
                    id="aff-58"
                    label={X.champReportANouveau}
                    valeur={reportANouveau}
                    onChange={setReportANouveau}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3 rounded-md bg-muted/30 p-3 text-sm">
                  <span>
                    {X.totalVentile} :{' '}
                    <strong className="font-mono tabular-nums">
                      {formatFcfa(totalVentile)}
                    </strong>
                  </span>
                  {ventilationValide ? (
                    <Badge ton="success">{X.ventilationComplete}</Badge>
                  ) : (
                    <Badge ton="warning">
                      {fmt(X.ventilationIncorrecte, {
                        total: formatFcfa(totalVentile),
                        montant: formatFcfa(montant),
                      })}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={() => setConfirmation(true)} disabled={!ventilationValide}>
                {X.affecterResultatBouton}
              </Button>
              <Button variant="ghost" onClick={onRetour}>
                {X.retour}
              </Button>
            </div>
          </section>
        )}

      {apercu && confirmation && (
        <section className="space-y-3 rounded-md border border-warning/50 bg-warning-subtle/40 p-4">
          <p className="font-medium">{fmt(X.confirmerAffectation, { code: exercice.code })}</p>
          {execution.isError && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{messageRefusCompte(execution.error, X.echec)}</AlertDescription>
            </Alert>
          )}
          <div className="flex gap-2">
            <Button
              onClick={() => execution.mutate(ventilationActuelle())}
              disabled={execution.isPending}
            >
              {execution.isPending ? X.affectationEnCours : X.confirmerAffectationBouton}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setConfirmation(false)}
              disabled={execution.isPending}
            >
              {X.annuler}
            </Button>
          </div>
        </section>
      )}

      {resultat && (
        <Alert role="status">
          <AlertDescription className="space-y-3">
            <p className="font-medium">
              {fmt(X.affectationReussie, { code: exercice.code, numero: resultat.entry_number })}
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

function ChampVentilation({
  id,
  label,
  valeur,
  onChange,
}: {
  id: string
  label: string
  valeur: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="numeric"
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

/**
 * À-nouveaux (lot b2b) : reprend les soldes de clôture des comptes de bilan (classes 1-5, 591
 * compris) comme soldes d'ouverture de l'exercice suivant, journal AN. INDÉPENDANT de
 * l'affectation du résultat (b2a) — 591 se reporte tel quel, affecté ou non. L'exercice suivant
 * doit déjà EXISTER et être ouvert (acte manuel séparé, jamais automatisé ici).
 */
function PanneauANouveaux({
  exercice,
  onRetour,
}: {
  exercice: ExerciceResume
  onRetour: () => void
}) {
  const client = useQueryClient()
  const [confirmation, setConfirmation] = useState(false)
  const [resultat, setResultat] = useState<ANouveauxResultat | null>(null)

  const apercuRequete = useQuery({
    queryKey: ['comptabilite', 'exercices', exercice.id, 'apercu-a-nouveaux'],
    queryFn: () => previsualiserANouveaux(exercice.id),
    enabled: resultat === null,
  })

  const execution = useMutation({
    mutationFn: () => genererANouveaux(exercice.id),
    onSuccess: (data) => {
      setResultat(data)
      setConfirmation(false)
      void client.invalidateQueries({ queryKey: CLE_LISTE })
    },
  })

  const apercu = apercuRequete.data ?? null

  function dateSuivantAttendue(): string {
    const fin = new Date(exercice.date_fin)
    fin.setDate(fin.getDate() + 1)
    return fin.toLocaleDateString('fr-FR')
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {fmt(X.anTitre, { code: exercice.code })}
        </h1>
      </div>

      {resultat === null && apercuRequete.isPending && (
        <p className="py-8 text-center text-sm text-muted-foreground">{X.anChargement}</p>
      )}

      {resultat === null && apercuRequete.isError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription className="space-y-2">
            <p>{X.anErreur}</p>
            <Button size="sm" variant="outline" onClick={() => void apercuRequete.refetch()}>
              {X.reessayer}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {resultat === null && apercu?.deja_genere && (
        <Alert role="status">
          <AlertDescription className="space-y-3">
            <p>{X.anDejaGeneres}</p>
            <Button size="sm" variant="ghost" onClick={onRetour}>
              {X.retour}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {resultat === null && apercu && !apercu.deja_genere && !confirmation && (
        <section className="space-y-4 rounded-md border p-4">
          {apercu.exercice_suivant === null && (
            <div role="alert" className="rounded-md border border-danger/50 bg-danger-subtle/40 px-3 py-2 text-sm">
              {fmt(X.anSuivantAbsent, { date: dateSuivantAttendue() })}
            </div>
          )}
          {apercu.exercice_suivant && apercu.exercice_suivant.status !== 'ouvert' && (
            <div role="alert" className="rounded-md border border-danger/50 bg-danger-subtle/40 px-3 py-2 text-sm">
              {fmt(X.anSuivantPasOuvert, {
                code: apercu.exercice_suivant.code,
                statut: apercu.exercice_suivant.status === 'clos' ? X.statutClos : apercu.exercice_suivant.status,
              })}
            </div>
          )}
          {!apercu.equilibre && (
            <div role="alert" className="rounded-md border border-danger/50 bg-danger-subtle/40 px-3 py-2 text-sm">
              {fmt(X.anDesequilibre, {
                debit: formatFcfa(apercu.total_debit),
                credit: formatFcfa(apercu.total_credit),
              })}
            </div>
          )}

          {apercu.lignes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{X.anRienAReporter}</p>
          ) : (
            <TableauANouveaux apercu={apercu} />
          )}

          <div className="flex gap-2">
            {apercu.generable && (
              <Button onClick={() => setConfirmation(true)}>{X.genererANouveaux}</Button>
            )}
            <Button variant="ghost" onClick={onRetour}>
              {X.retour}
            </Button>
          </div>
        </section>
      )}

      {apercu?.exercice_suivant && confirmation && (
        <section className="space-y-3 rounded-md border border-warning/50 bg-warning-subtle/40 p-4">
          <p className="font-medium">
            {fmt(X.confirmerANouveaux, {
              codeSuivant: apercu.exercice_suivant.code,
              codeSource: exercice.code,
            })}
          </p>
          {execution.isError && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{messageRefusCompte(execution.error, X.echec)}</AlertDescription>
            </Alert>
          )}
          <div className="flex gap-2">
            <Button onClick={() => execution.mutate()} disabled={execution.isPending}>
              {execution.isPending ? X.anEnCours : X.confirmerANouveauxBouton}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setConfirmation(false)}
              disabled={execution.isPending}
            >
              {X.annuler}
            </Button>
          </div>
        </section>
      )}

      {resultat && (
        <Alert role="status">
          <AlertDescription className="space-y-3">
            <p className="font-medium">
              {fmt(X.anReussis, { code: exercice.code, numero: resultat.entry_number })}
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

function TableauANouveaux({ apercu }: { apercu: ApercuANouveaux }) {
  return (
    <div className="overflow-x-auto">
      <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
        {X.anDetailTitre}
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-1 pr-2 font-medium">{X.colANCompte}</th>
            <th className="py-1 pr-2 font-medium">{X.colANLibelle}</th>
            <th className="py-1 pr-2 text-right font-medium">{X.colANSens}</th>
            <th className="py-1 text-right font-medium">{X.colANMontant}</th>
          </tr>
        </thead>
        <tbody>
          {apercu.lignes.map((ligne) => (
            <tr key={ligne.account_number} className="border-b last:border-0">
              <td className="py-1 pr-2 font-mono text-xs">{ligne.account_number}</td>
              <td className="py-1 pr-2">{ligne.name}</td>
              <td className="py-1 pr-2 text-right text-xs">
                {ligne.side === 'D' ? X.sensDebit : X.sensCredit}
              </td>
              <td className="py-1 text-right font-mono tabular-nums">
                {formatFcfa(ligne.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-right text-sm font-medium">
        {fmt(X.anTotalReporte, { montant: formatFcfa(apercu.total_debit) })}
      </p>
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
