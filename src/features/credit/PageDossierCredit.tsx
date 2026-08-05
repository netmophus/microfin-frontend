import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { ArrowLeft, Printer } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAPermission } from '@/features/auth/useProfil'
import { BadgeStatutDossier, BadgeStatutEcheance } from '@/features/credit/badges'
import {
  decaisserDemandeCredit,
  deciderDemandeCredit,
  lireApercuEcheancierCredit,
  lireDemandeCredit,
  lireEcheancierCredit,
  messageRefusCredit,
  type DemandeCreditDetail,
  type EcheanceApercuCredit,
  type EcheanceCredit,
} from '@/features/credit/api'
import { formatFcfa } from '@/features/epargne/api'
import { LIBELLES } from '@/libelles/fr'

const C = LIBELLES.credit

function Ligne({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{valeur}</dd>
    </div>
  )
}

function RetourListeCredit() {
  return (
    <Link
      to="/credit"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> {C.retour}
    </Link>
  )
}

/**
 * Vue détail d'un dossier de crédit : infos, décision (CR6a), décaissement + échéancier (CR6b).
 */
export function PageDossierCredit() {
  const { id = '' } = useParams()
  const client = useQueryClient()

  const requete = useQuery({
    queryKey: ['credit', 'demande', id],
    queryFn: () => lireDemandeCredit(id),
  })

  if (requete.isPending) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{C.chargement}</p>
  }

  if (requete.isError) {
    const introuvable =
      requete.error instanceof AxiosError && requete.error.response?.status === 404
    return (
      <div className="space-y-4">
        <RetourListeCredit />
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {introuvable ? C.dossierIntrouvable : C.erreurListe}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const d = requete.data
  const rafraichir = () => {
    void client.invalidateQueries({ queryKey: ['credit', 'demande', id] })
    void client.invalidateQueries({ queryKey: ['credit', 'demandes'] })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <RetourListeCredit />

      <header className="space-y-3 rounded-lg border bg-card p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-mono text-lg font-semibold tracking-tight">
              {d.application_number}
            </h1>
            <p className="text-sm text-muted-foreground">
              {d.tier_nom} · {d.tier_number}
            </p>
          </div>
          <BadgeStatutDossier statut={d.status} />
        </div>
        <dl className="divide-y">
          <Ligne label={C.produit} valeur={d.product_name} />
          <Ligne label={C.montantDemande} valeur={formatFcfa(d.montant_demande)} />
          <Ligne label={C.dureeEcheances} valeur={C.dureeValeur(d.duree_echeances)} />
          {d.objet && <Ligne label={C.objet} valeur={d.objet} />}
          <Ligne label={C.creeLe} valeur={new Date(d.created_at).toLocaleDateString('fr-FR')} />
        </dl>
      </header>

      {d.status !== 'en_instruction' && (
        <section className="space-y-1 rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold">{C.decisionTitre}</h2>
          <p className="text-sm">
            {d.status === 'approuve' && C.decisionApprouvee(formatFcfa(d.montant_decide ?? 0))}
            {d.status === 'refuse' && C.decisionRefusee}
            {d.status === 'decaisse' && C.decisionDecaissee}
          </p>
          {d.motif_decision && (
            <p className="text-sm text-muted-foreground">
              {C.motifLabel} {d.motif_decision}
            </p>
          )}
        </section>
      )}

      {d.status === 'en_instruction' && <PanneauDecision dossier={d} onDecide={rafraichir} />}

      {d.status === 'approuve' && (
        <>
          <ApercuEcheancier dossier={d} />
          <PanneauDecaissement dossier={d} onDecaisse={rafraichir} />
        </>
      )}

      {d.status === 'decaisse' && <TableauEcheancier applicationId={d.id} />}
    </div>
  )
}

type ModeDecision = 'approuve' | 'refuse'

function PanneauDecision({
  dossier,
  onDecide,
}: {
  dossier: DemandeCreditDetail
  onDecide: () => void
}) {
  const peutDecider = useAPermission('credit.demande.decide')
  const [mode, setMode] = useState<ModeDecision | null>(null)
  const [montant, setMontant] = useState(String(dossier.montant_demande))
  const [motif, setMotif] = useState('')

  const montantNum = Number.parseInt(montant.replace(/\D/g, ''), 10) || 0
  const montantValide = mode !== 'approuve' || (montantNum > 0 && montantNum <= dossier.montant_demande)
  const motifValide = motif.trim().length >= 3

  const mutation = useMutation({
    mutationFn: () =>
      deciderDemandeCredit(dossier.id, {
        decision: mode as ModeDecision,
        montant_decide: mode === 'approuve' ? montantNum : undefined,
        motif: motif.trim(),
      }),
    onSuccess: onDecide,
  })

  if (!peutDecider) return null

  if (!mode) {
    return (
      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">{C.decisionTitre}</h2>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setMode('approuve')}>
            {C.actionApprouver}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setMode('refuse')}>
            {C.actionRefuser}
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section
      className={
        mode === 'approuve'
          ? 'space-y-3 rounded-lg border border-brand/40 bg-brand-subtle/40 p-4'
          : 'space-y-3 rounded-lg border border-warning/40 bg-warning-subtle/40 p-4'
      }
    >
      <h2 className="text-sm font-semibold">
        {mode === 'approuve' ? C.actionApprouver : C.actionRefuser}
      </h2>

      {mode === 'approuve' && (
        <div className="space-y-1">
          <Label htmlFor="montant-decide-credit">{C.montantDecide}</Label>
          <Input
            id="montant-decide-credit"
            inputMode="numeric"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {C.montantDecideAide(formatFcfa(dossier.montant_demande))}
          </p>
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor="motif-decision-credit">{C.motif}</Label>
        <Input
          id="motif-decision-credit"
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder={C.motifPlaceholder}
        />
      </div>

      {mutation.isError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{messageRefusCredit(mutation.error, C.decisionEchec)}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={!montantValide || !motifValide || mutation.isPending}
        >
          {mutation.isPending ? C.decisionEnCours : C.confirmerDecision}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setMode(null)
            setMotif('')
          }}
          disabled={mutation.isPending}
        >
          {C.annuler}
        </Button>
      </div>
    </section>
  )
}

/**
 * Décaissement (CR6b), réservé au responsable d'agence. Confirmation en 2 temps — jamais un
 * clic aveugle : le montant, le compte destinataire, la génération de l'échéancier et le
 * caractère définitif sont tous énoncés AVANT le bouton de confirmation.
 */
function PanneauDecaissement({
  dossier,
  onDecaisse,
}: {
  dossier: DemandeCreditDetail
  onDecaisse: () => void
}) {
  const peutDecaisser = useAPermission('credit.decaissement.create')
  const [confirmation, setConfirmation] = useState(false)

  const mutation = useMutation({
    mutationFn: () => decaisserDemandeCredit(dossier.id),
    onSuccess: onDecaisse,
  })

  if (!peutDecaisser) return null

  if (!confirmation) {
    return (
      <section className="rounded-lg border p-4">
        <Button size="sm" onClick={() => setConfirmation(true)}>
          {C.actionDecaisser}
        </Button>
      </section>
    )
  }

  const compteLabelCreance = dossier.is_member
    ? C.decaissementCompteMembre
    : C.decaissementCompteClient

  return (
    <section className="space-y-3 rounded-lg border border-warning/40 bg-warning-subtle/40 p-4">
      <h2 className="text-sm font-semibold">{C.decaissementTitre}</h2>
      <p className="text-sm font-medium">
        {C.decaissementMontant(formatFcfa(dossier.montant_decide ?? 0))}
      </p>
      <p className="text-sm">
        {C.decaissementExplication(compteLabelCreance, C.dureeValeur(dossier.duree_echeances))}
      </p>

      {mutation.isError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {messageRefusCredit(mutation.error, C.decaissementEchec)}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? C.decaissementEnCours : C.decaissementConfirmer}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setConfirmation(false)}
          disabled={mutation.isPending}
        >
          {C.annuler}
        </Button>
      </div>
    </section>
  )
}

/** Table partagée par l'échéancier réel (avec statut) et l'aperçu (sans — rien n'est suivi). */
function TableEcheances({
  lignes,
  avecStatut,
}: {
  lignes: (EcheanceCredit | EcheanceApercuCredit)[]
  avecStatut: boolean
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-3 py-2 text-left font-medium">{C.colEcheance}</th>
            <th className="px-3 py-2 text-left font-medium">{C.colEcheanceDate}</th>
            <th className="px-3 py-2 text-right font-medium">{C.colCapital}</th>
            <th className="px-3 py-2 text-right font-medium">{C.colInterets}</th>
            <th className="px-3 py-2 text-right font-medium">{C.colTotal}</th>
            <th className="px-3 py-2 text-right font-medium">{C.colCapitalRestant}</th>
            {avecStatut && (
              <th className="px-3 py-2 text-left font-medium">{C.colStatutEcheance}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {lignes.map((e) => (
            <tr key={e.numero} className="border-b last:border-0">
              <td className="px-3 py-2 tabular-nums">{e.numero}</td>
              <td className="px-3 py-2">{new Date(e.due_date).toLocaleDateString('fr-FR')}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatFcfa(e.capital)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatFcfa(e.interets)}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">
                {formatFcfa(e.total)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                {formatFcfa(e.capital_restant_du)}
              </td>
              {avecStatut && 'status' in e && (
                <td className="px-3 py-2">
                  <BadgeStatutEcheance statut={e.status} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** L'échéancier persisté — reste visible à CHAQUE revisite du dossier, pas seulement juste
 * après le décaissement (nouvelle requête, indépendante de la mutation). */
function TableauEcheancier({ applicationId }: { applicationId: string }) {
  const requete = useQuery({
    queryKey: ['credit', 'echeancier', applicationId],
    queryFn: () => lireEcheancierCredit(applicationId),
  })

  if (requete.isPending) {
    return <p className="py-4 text-sm text-muted-foreground">{C.chargement}</p>
  }
  if (requete.isError) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription>{C.erreurListe}</AlertDescription>
      </Alert>
    )
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">{C.echeancierTitre}</h2>
      <TableEcheances lignes={requete.data} avecStatut />
    </section>
  )
}

/**
 * Aperçu PUR de l'échéancier (CR6b), dès que le dossier est approuvé — À PRÉSENTER AU CLIENT
 * avant tout décaissement, pour signature. Aucune écriture : c'est un calcul, affiché
 * au-dessus du bloc de décaissement. Le bandeau distingue explicitement ce qui est garanti
 * (les montants) de ce qui est indicatif (les dates, recalculées à la date réelle).
 *
 * IMPRESSION : le bouton déclenche window.print() sur `.zone-impression` (voir index.css) —
 * seuls l'identité du tiers, le montant, le produit, le bandeau et le tableau atterrissent sur
 * le papier ; navigation et boutons disparaissent. L'en-tête imprimable et la ligne de
 * signature sont `hidden` à l'écran (déjà visibles ailleurs, ou sans objet hors impression) et
 * `print:block`/`print:grid` sur le papier.
 */
function ApercuEcheancier({ dossier }: { dossier: DemandeCreditDetail }) {
  const requete = useQuery({
    queryKey: ['credit', 'echeancier-apercu', dossier.id],
    queryFn: () => lireApercuEcheancierCredit(dossier.id),
  })

  if (requete.isPending) {
    return <p className="py-4 text-sm text-muted-foreground">{C.apercuChargement}</p>
  }
  if (requete.isError) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription>{C.apercuErreur}</AlertDescription>
      </Alert>
    )
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{C.apercuTitre}</h2>
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <Printer className="mr-1 size-4" />
          {C.apercuImprimer}
        </Button>
      </div>

      <div className="zone-impression space-y-4">
        {/* En-tête du document — invisible à l'écran (déjà affiché dans l'en-tête du dossier
            ci-dessus), imprimé seul en haut du papier. */}
        <div className="hidden print:block">
          <h1 className="text-lg font-semibold">{C.apercuDocumentTitre}</h1>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{C.apercuDocDossier}</dt>
              <dd>{dossier.application_number}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{C.apercuDocTiers}</dt>
              <dd>
                {dossier.tier_nom} · {dossier.tier_number}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{C.produit}</dt>
              <dd>{dossier.product_name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{C.montantDecide}</dt>
              <dd className="font-semibold">{formatFcfa(dossier.montant_decide ?? 0)}</dd>
            </div>
          </dl>
        </div>

        <div
          role="note"
          className="rounded-md border border-warning/50 bg-warning-subtle/40 px-3 py-2 text-sm"
        >
          <p className="font-medium">{C.apercuBanniereTitre}</p>
          <p>
            {C.apercuBanniereAvantMontant}
            <strong>{C.apercuBanniereMontantGras}</strong>
            {C.apercuBanniereEntreMontantDate}
            <strong>{C.apercuBanniereDateGras}</strong>
            {C.apercuBanniereApresDate}
          </p>
        </div>

        <TableEcheances lignes={requete.data} avecStatut={false} />

        {/* Signature — sans objet à l'écran, imprimée seulement. */}
        <div className="hidden print:grid print:grid-cols-2 print:gap-8 print:pt-10 print:text-sm">
          <div>
            <p>{C.apercuSignatureClient}</p>
            <div className="mt-10 border-t border-foreground" />
          </div>
          <div>
            <p>{C.apercuSignatureDate}</p>
            <div className="mt-10 border-t border-foreground" />
          </div>
        </div>
      </div>
    </section>
  )
}
