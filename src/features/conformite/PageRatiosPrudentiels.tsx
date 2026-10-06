import { useQuery } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { ShieldCheck, TriangleAlert, X } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge, type BadgeTon } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  chargerDetailRatio,
  chargerRatios,
  formatPourcentage,
  type Avertissement,
  type DetailAgregat,
  type RatioEvalue,
  type TableauRatios,
} from '@/features/conformite/api'
import { formatFcfa } from '@/features/epargne/api'
import { LIBELLES } from '@/libelles/fr'

const R = LIBELLES.ratiosPrudentiels

function fmt(gabarit: string, valeurs: Record<string, string>): string {
  return gabarit.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '')
}

function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10)
}

function dateFr(iso: string): string {
  const [annee, mois, jour] = iso.split('-')
  return `${jour}/${mois}/${annee}`
}

type PresentationStatut = {
  libelle: string
  ton: BadgeTon
  enAttente: boolean
  // CONFORME qui porte un avertissement : vert ATTÉNUÉ + icône, jamais le vert franc rassurant.
  reserve: boolean
}

/**
 * Un ratio « en attente » (actif = false) n'est JAMAIS présenté comme un résultat : aucun
 * chiffre, ligne grisée, badge distinct (pointillés, sans pastille). C'est le garde-fou de
 * l'écran — un ratio non activé qui ressemblerait à un résultat serait une fausse déclaration.
 */
function presenter(ratio: RatioEvalue): PresentationStatut {
  if (!ratio.actif) {
    return { libelle: R.statutEnAttente, ton: 'neutral', enAttente: true, reserve: false }
  }
  if (ratio.statut === 'CONFORME') {
    return {
      libelle: R.statutConforme,
      ton: 'success',
      enAttente: false,
      reserve: ratio.avertissements.length > 0,
    }
  }
  if (ratio.statut === 'NON_CONFORME') {
    return { libelle: R.statutNonConforme, ton: 'danger', enAttente: false, reserve: false }
  }
  return { libelle: R.statutNonCalculable, ton: 'neutral', enAttente: false, reserve: false }
}

function formatSeuil(ratio: RatioEvalue): string {
  const op = ratio.operateur === 'LE' ? R.operateurLe : R.operateurGe
  return `${op} ${formatPourcentage(ratio.seuil_applicable)}`
}

function formatEcart(ratio: RatioEvalue): string {
  if (ratio.marge === null) return '—'
  const valeur = Math.abs(Number(ratio.marge)).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return fmt(ratio.statut === 'NON_CONFORME' ? R.ecartNonConforme : R.margeConforme, { valeur })
}

/**
 * Tableau de bord des ratios prudentiels à une date d'arrêté — consultation seule. Écran
 * destiné à la direction et pouvant être présenté à la tutelle : chaque chiffre est
 * justifiable (clic sur une ligne -> numérateur, dénominateur et leur décomposition).
 */
export function PageRatiosPrudentiels() {
  const [date, setDate] = useState(aujourdhui)
  const [codeOuvert, setCodeOuvert] = useState<string | null>(null)

  const requete = useQuery({
    queryKey: ['conformite', 'ratios', date],
    queryFn: () => chargerRatios(date),
  })

  function changerDate(valeur: string) {
    setDate(valeur)
    setCodeOuvert(null)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <ShieldCheck className="size-5 text-muted-foreground" />
          {R.titre}
        </h1>
        <p className="text-sm text-muted-foreground">{R.sousTitre}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/20 p-3">
        <div className="space-y-1">
          <Label htmlFor="ratios-date">{R.filtreDate}</Label>
          <Input
            id="ratios-date"
            type="date"
            value={date}
            onChange={(e) => changerDate(e.target.value)}
            className="w-auto"
          />
        </div>
      </div>

      {requete.isPending ? (
        <SqueletteTableau />
      ) : requete.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {requete.error instanceof AxiosError && requete.error.response?.status === 403
                ? R.interdit
                : R.erreur}
            </span>
            <Button variant="outline" size="sm" onClick={() => void requete.refetch()}>
              {R.reessayer}
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <Contenu
          tableau={requete.data}
          date={date}
          codeOuvert={codeOuvert}
          onOuvrir={setCodeOuvert}
        />
      )}
    </div>
  )
}

function Contenu({
  tableau,
  date,
  codeOuvert,
  onOuvrir,
}: {
  tableau: TableauRatios
  date: string
  codeOuvert: string | null
  onOuvrir: (code: string | null) => void
}) {
  const ratios = tableau.ratios
  if (ratios.length === 0) {
    return (
      <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
        {R.vide}
      </p>
    )
  }

  const actifs = ratios.filter((r) => r.actif)
  const compte = (statut: RatioEvalue['statut']) =>
    actifs.filter((r) => r.statut === statut).length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="font-medium">{fmt(R.dateReference, { date: dateFr(date) })}</p>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
          <span>{fmt(R.syntheseConformes, { n: String(compte('CONFORME')) })}</span>
          <span>{fmt(R.syntheseNonConformes, { n: String(compte('NON_CONFORME')) })}</span>
          <span>{fmt(R.syntheseNonCalculables, { n: String(compte('NON_CALCULABLE')) })}</span>
          <span>{fmt(R.syntheseEnAttente, { n: String(ratios.length - actifs.length) })}</span>
        </p>
      </div>

      {tableau.aucune_ecriture_validee && (
        <div role="status" className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
          {R.aucuneEcriture}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr className="text-left text-xs text-muted-foreground">
              <th scope="col" className="px-3 py-2 font-medium">
                {R.colRatio}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {R.colReference}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {R.colSeuil}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {R.colValeur}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {R.colStatut}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {R.colEcart}
              </th>
              <th scope="col" className="px-3 py-2">
                <span className="sr-only">{R.voirDetail}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ratios.map((ratio) => (
              <LigneRatio
                key={ratio.code}
                ratio={ratio}
                ouvert={ratio.code === codeOuvert}
                onOuvrir={() => onOuvrir(ratio.code === codeOuvert ? null : ratio.code)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {codeOuvert !== null && (
        <PanneauDetail code={codeOuvert} date={date} onFermer={() => onOuvrir(null)} />
      )}
    </div>
  )
}

function LigneRatio({
  ratio,
  ouvert,
  onOuvrir,
}: {
  ratio: RatioEvalue
  ouvert: boolean
  onOuvrir: () => void
}) {
  const p = presenter(ratio)
  const grise = p.enAttente
  return (
    <tr
      className={`h-10 border-b last:border-0 ${grise ? 'bg-muted/30 text-muted-foreground' : ''} ${ouvert ? 'bg-brand-subtle/40' : ''}`}
    >
      <th scope="row" className="px-3 py-1.5 text-left font-normal">
        <span className={grise ? 'italic' : 'font-medium text-foreground'}>{ratio.libelle}</span>
        <ListeAvertissements avertissements={ratio.avertissements} />
      </th>
      <td className="px-3 py-1.5 font-mono text-xs">{ratio.reference_reglementaire ?? '—'}</td>
      <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono tabular-nums">
        {grise ? '—' : formatSeuil(ratio)}
      </td>
      <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono tabular-nums">
        {grise || ratio.statut === 'NON_CALCULABLE' ? '—' : formatPourcentage(ratio.valeur_ratio_pct)}
      </td>
      <td className="px-3 py-1.5">
        <Badge
          ton={p.ton}
          pastille={!p.enAttente && !p.reserve}
          className={
            p.enAttente
              ? 'border border-dashed border-border bg-transparent'
              : p.reserve
                ? 'border border-success/40 bg-success-subtle/40'
                : undefined
          }
        >
          {p.reserve && <TriangleAlert className="size-3.5" aria-hidden />}
          {p.libelle}
          {p.reserve && <span className="sr-only"> {R.conformeAvecAvertissement}</span>}
        </Badge>
      </td>
      <td className="whitespace-nowrap px-3 py-1.5 text-xs">
        {grise
          ? R.enAttenteTexte
          : ratio.statut === 'NON_CALCULABLE'
            ? R.nonCalculableTexte
            : formatEcart(ratio)}
      </td>
      <td className="px-3 py-1.5 text-right">
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={ouvert}
          aria-label={fmt(R.voirDetailRatio, { libelle: ratio.libelle })}
          onClick={onOuvrir}
        >
          {R.voirDetail}
        </Button>
      </td>
    </tr>
  )
}

/** Icône + texte : l'information n'est jamais portée par la couleur seule (CLAUDE.md §8). */
function ListeAvertissements({ avertissements }: { avertissements: Avertissement[] }) {
  if (avertissements.length === 0) return null
  return (
    <ul aria-label={R.detailAvertissements} className="mt-0.5 space-y-0.5">
      {avertissements.map((a) => (
        <li key={a.code} className="flex items-center gap-1 text-xs font-normal text-warning">
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
          <span>{a.libelle}</span>
        </li>
      ))}
    </ul>
  )
}

function PanneauDetail({
  code,
  date,
  onFermer,
}: {
  code: string
  date: string
  onFermer: () => void
}) {
  const requete = useQuery({
    queryKey: ['conformite', 'ratios', code, date],
    queryFn: () => chargerDetailRatio(code, date),
  })

  return (
    <section
      aria-label={R.detailTitre}
      className="space-y-3 rounded-md border border-border-strong p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {R.detailTitre}
          </p>
          {requete.data && <h2 className="text-base font-semibold">{requete.data.libelle}</h2>}
          {requete.data && <ListeAvertissements avertissements={requete.data.avertissements} />}
          {requete.data && requete.data.actif && requete.data.statut !== 'NON_CALCULABLE' && (
            <p className="text-sm text-muted-foreground">
              {fmt(R.detailResume, {
                valeur: formatPourcentage(requete.data.valeur_ratio_pct),
                seuil: formatSeuil(requete.data),
              })}
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onFermer} aria-label={R.detailFermer}>
          <X className="size-4" aria-hidden />
        </Button>
      </div>

      {requete.isPending ? (
        <p className="py-4 text-sm text-muted-foreground">{R.detailChargement}</p>
      ) : requete.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{R.detailErreur}</span>
            <Button variant="outline" size="sm" onClick={() => void requete.refetch()}>
              {R.reessayer}
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {!requete.data.actif && (
            <div role="status" className="rounded-md border border-dashed px-3 py-2 text-sm">
              {R.detailEnAttente}
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <BlocAgregat titre={R.detailNumerateur} agregat={requete.data.agregat_numerateur} />
            <BlocAgregat titre={R.detailDenominateur} agregat={requete.data.agregat_denominateur} />
          </div>
        </>
      )}
    </section>
  )
}

function BlocAgregat({ titre, agregat }: { titre: string; agregat: DetailAgregat }) {
  // Seuls les comptes à solde non nul justifient le chiffre : les dizaines de lignes à zéro
  // de la composition noieraient l'information. Elles restent consultables à la demande.
  const [avecNuls, setAvecNuls] = useState(false)
  const nuls = agregat.composants.filter((c) => c.solde === 0)
  const composants = avecNuls ? agregat.composants : agregat.composants.filter((c) => c.solde !== 0)
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {titre}
      </p>
      <p className="text-sm font-medium">{agregat.libelle}</p>
      <p className="mb-2 text-sm">
        <span className="text-muted-foreground">{R.detailValeur} : </span>
        <span className="font-mono font-semibold tabular-nums">{formatFcfa(agregat.valeur)}</span>
      </p>

      {agregat.type === 'SPECIAL' ? (
        <p className="text-sm text-muted-foreground">{R.detailCompositionSpeciale}</p>
      ) : agregat.composants.length === 0 ? (
        <p className="text-sm text-muted-foreground">{R.detailCompositionVide}</p>
      ) : (
        <table className="w-full text-sm">
          <caption className="sr-only">{`${R.detailComposition} — ${agregat.libelle}`}</caption>
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="py-1 pr-2 font-medium">
                {R.colPrefixe}
              </th>
              <th scope="col" className="py-1 pr-2 text-center font-medium">
                {R.colSens}
              </th>
              <th scope="col" className="py-1 pr-2 text-right font-medium">
                {R.colSolde}
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                {R.colContribution}
              </th>
            </tr>
          </thead>
          <tbody>
            {composants.map((c) => (
              <tr key={`${c.prefixe_compte}-${c.sens}`} className="border-b last:border-0">
                <td className="py-1 pr-2 font-mono text-xs">{c.prefixe_compte}</td>
                <td className="py-1 pr-2 text-center font-mono">
                  {c.sens === 1 ? R.sensPlus : R.sensMoins}
                </td>
                <td className="py-1 pr-2 text-right font-mono tabular-nums">
                  {formatFcfa(c.solde)}
                </td>
                <td className="py-1 text-right font-mono tabular-nums">
                  {formatFcfa(c.contribution)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t font-semibold">
              <td className="py-1 pr-2" colSpan={3}>
                {R.totalAgregat}
              </td>
              <td className="py-1 text-right font-mono tabular-nums">
                {formatFcfa(agregat.valeur)}
              </td>
            </tr>
          </tfoot>
        </table>
      )}

      {agregat.type === 'BALANCE' && agregat.composants.length > 0 && composants.length === 0 && (
        <p className="py-2 text-sm text-muted-foreground">{R.aucunSoldeNonNul}</p>
      )}
      {nuls.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-1"
          aria-expanded={avecNuls}
          onClick={() => setAvecNuls((v) => !v)}
        >
          {avecNuls ? R.masquerSoldesNuls : fmt(R.afficherSoldesNuls, { n: String(nuls.length) })}
        </Button>
      )}

      {agregat.complement_provisions_tutelle_applique !== null && (
        <p className="mt-2 text-xs text-muted-foreground">
          {fmt(R.complementTutelle, {
            montant: formatFcfa(agregat.complement_provisions_tutelle_applique),
          })}
        </p>
      )}
    </div>
  )
}

/** Squelette de la structure réelle (CLAUDE.md §6) — pas un rond qui tourne. */
function SqueletteTableau() {
  return (
    <div role="status" aria-label={R.chargement} className="rounded-md border">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex h-10 items-center gap-4 border-b px-3 last:border-0">
          <div className="h-3 w-1/3 motion-safe:animate-pulse rounded bg-muted" />
          <div className="h-3 w-24 motion-safe:animate-pulse rounded bg-muted" />
          <div className="ml-auto h-3 w-16 motion-safe:animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}
