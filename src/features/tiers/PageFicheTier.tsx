import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Ban,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  FilePlus2,
  Landmark,
  PauseCircle,
  PencilLine,
  Phone,
  PlayCircle,
  RotateCcw,
  Tag,
  UserRound,
  Venus,
} from 'lucide-react'
import { useMemo, useState, type ComponentType } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { AvatarInitiales } from '@/components/ui/avatar-initiales'
import { useAPermission } from '@/features/auth/useProfil'
import { ActionsTier } from '@/features/tiers/actions-tier'
import { BadgeStatut } from '@/features/tiers/badges'
import { OngletComptesEpargne } from '@/features/epargne/OngletComptesEpargne'
import { OngletCoordonnees } from '@/features/tiers/OngletCoordonnees'
import { OngletKyc } from '@/features/tiers/OngletKyc'
import { OngletPieces } from '@/features/tiers/OngletPieces'
import {
  ErreurFiche,
  lireTier,
  lireTimeline,
  type EvenementTimeline,
  type FicheTier,
} from '@/features/tiers/api'
import { lireConditionsActivation } from '@/features/tiers/kyc'
import { listerAgences } from '@/features/utilisateurs/agences'
import { LIBELLES } from '@/libelles/fr'

const T = LIBELLES.tiersFiche
const G = LIBELLES.tiers

type Icone = ComponentType<{ className?: string }>

/** Nom d'affichage : depuis le bloc de détail (vue complète) ou display_name (vue résumée). */
function nomAffichage(fiche: FicheTier): string {
  if (fiche.individu) return `${fiche.individu.last_name} ${fiche.individu.first_name}`
  if (fiche.personne_morale) return fiche.personne_morale.legal_name
  if (fiche.groupement) return fiche.groupement.group_name
  return fiche.display_name ?? fiche.tier_number
}

function Ligne({
  label,
  valeur,
  icone: Icone,
}: {
  label: string
  valeur: string | null | undefined
  icone?: Icone
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <dt className="flex items-center gap-2 text-muted-foreground">
        {Icone && <Icone className="size-4 shrink-0 text-muted-foreground/70" />}
        {label}
      </dt>
      <dd className="text-right font-medium">{valeur?.trim() ? valeur : T.sansValeur}</dd>
    </div>
  )
}

function formaterDate(iso: string | null | undefined): string {
  if (!iso) return T.sansValeur
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('fr-FR')
}

export function PageFicheTier() {
  const { id = '' } = useParams()
  const requete = useQuery({ queryKey: ['tiers', 'fiche', id], queryFn: () => lireTier(id) })

  // La frise est réservée aux porteurs de tiers.read (un caissier en read.basic aurait un 403).
  const peutVoirDetail = useAPermission('tiers.read')
  const timeline = useQuery({
    queryKey: ['tiers', 'timeline', id],
    queryFn: () => lireTimeline(id),
    enabled: peutVoirDetail && requete.isSuccess,
  })

  const agences = useQuery({ queryKey: ['agences'], queryFn: listerAgences })
  const nomAgence = useMemo(() => {
    const table = new Map((agences.data ?? []).map((a) => [a.id, a.name]))
    return (idAgence: string) => table.get(idAgence) ?? T.sansValeur
  }, [agences.data])

  // Après une transition : tout ce qui commence par 'tiers' est invalidé -> la fiche (statut,
  // donc les actions disponibles) ET la frise se rafraîchissent, la liste aussi.
  const queryClient = useQueryClient()
  const rafraichir = () => void queryClient.invalidateQueries({ queryKey: ['tiers'] })

  if (requete.isPending) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{T.chargement}</p>
  }

  if (requete.isError) {
    const introuvable = requete.error instanceof ErreurFiche && requete.error.echec.type === 'introuvable'
    return (
      <div className="space-y-4">
        <RetourListe />
        <Alert variant="destructive" role="alert">
          <AlertDescription>{introuvable ? G.introuvable : G.erreur}</AlertDescription>
        </Alert>
      </div>
    )
  }

  const fiche = requete.data
  // Le bloc de détail n'est présent que sur la vue complète. Le front ne suppose jamais sa
  // présence : absent (cas caissier) -> on affiche le résumé, sans casser.
  const aLeDetail = Boolean(fiche.individu || fiche.personne_morale || fiche.groupement)

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <RetourListe />

      {/* En-tête : avatar + nom + numéro mono + badge de statut. */}
      <header className="flex items-center gap-4 rounded-lg border bg-card p-4">
        <AvatarInitiales nom={nomAffichage(fiche)} taille="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-tight">{nomAffichage(fiche)}</h1>
          <p className="font-mono text-xs text-muted-foreground">{fiche.tier_number}</p>
        </div>
        <BadgeStatut code={fiche.status} />
      </header>

      {fiche.status === 'prospect' && peutVoirDetail && <BandeauProspect tierId={fiche.id} />}

      {fiche.status === 'desactive' && (
        <Alert variant="destructive">
          <AlertDescription>
            <span className="font-medium">{T.desactiveeTitre}.</span> {T.desactiveeAide}
          </AlertDescription>
        </Alert>
      )}

      {/* Deux colonnes pour un logiciel qui respire : identité + actions à gauche, contenu riche
          (onglets + frise) à droite. Le caissier (read.basic) n'a que l'identité, en une colonne. */}
      <div className={peutVoirDetail ? 'grid gap-5 lg:grid-cols-3' : ''}>
        <div className="space-y-5 lg:col-span-1">
          <section className="rounded-lg border bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold">{T.identite}</h2>
            <dl className="divide-y">
              <Ligne label={T.type} valeur={G.types[fiche.tier_type] ?? fiche.tier_type} icone={Tag} />
              <Ligne label={T.agence} valeur={nomAgence(fiche.primary_agency_id)} icone={Landmark} />
              {fiche.primary_phone !== undefined && (
                <Ligne label={T.telephone} valeur={fiche.primary_phone} icone={Phone} />
              )}
              {fiche.individu && <DetailIndividu detail={fiche.individu} />}
              {fiche.personne_morale && <DetailMorale detail={fiche.personne_morale} />}
              {fiche.groupement && <DetailGroupement detail={fiche.groupement} />}
              {fiche.created_at && (
                <Ligne label={T.creeLe} valeur={formaterDate(fiche.created_at)} icone={CalendarDays} />
              )}
            </dl>

            {!aLeDetail && (
              <p className="mt-3 rounded bg-muted/40 p-2 text-xs text-muted-foreground">
                <span className="font-medium">{T.vueLimitee}.</span> {T.vueLimiteeAide}
              </p>
            )}
          </section>

          <ActionsTier tier={fiche} onChangement={rafraichir} />
        </div>

        {peutVoirDetail && (
          <div className="space-y-5 lg:col-span-2">
            <OngletsDetail fiche={fiche} />
            <SectionTimeline requete={timeline} />
          </div>
        )}
      </div>
    </div>
  )
}

const O = LIBELLES.tiersOnglets
const P = LIBELLES.tiersFiche

/** Bandeau prospect : l'ÉTAT RÉEL du dossier. Liste ce qui reste à compléter (depuis le backend),
 *  AVANT le clic « Activer » — l'utilisateur sait quoi faire. « Prête à activer » sinon. */
function BandeauProspect({ tierId }: { tierId: string }) {
  const requete = useQuery({
    queryKey: ['tiers', 'conditions', tierId],
    queryFn: () => lireConditionsActivation(tierId),
  })
  if (requete.isPending) {
    return (
      <Alert>
        <AlertDescription>{P.prospectChargement}</AlertDescription>
      </Alert>
    )
  }
  if (requete.isError || !requete.data) {
    return null
  }
  if (requete.data.activable) {
    return (
      <Alert>
        <AlertDescription>
          <span className="font-medium">{P.prospectTitre}.</span> {P.prospectPret}
        </AlertDescription>
      </Alert>
    )
  }
  return (
    <Alert>
      <AlertDescription>
        <span className="font-medium">{P.prospectACompleter}</span>
        <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm">
          {requete.data.conditions.map((c) => (
            <li key={c.code}>{c.libelle}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}

/** Bascule Coordonnées / Pièces / KYC / Épargne. Un seul onglet monté à la fois. */
function OngletsDetail({ fiche }: { fiche: FicheTier }) {
  const [onglet, setOnglet] = useState<'coordonnees' | 'pieces' | 'kyc' | 'epargne'>('coordonnees')
  // L'onglet KYC détaillé ne concerne que la personne physique (T3c).
  const kycDispo = Boolean(fiche.individu)
  return (
    <section className="rounded-md border">
      <div className="flex border-b" role="tablist">
        <BoutonOnglet actif={onglet === 'coordonnees'} onClick={() => setOnglet('coordonnees')}>
          {O.coordonnees}
        </BoutonOnglet>
        <BoutonOnglet actif={onglet === 'pieces'} onClick={() => setOnglet('pieces')}>
          {O.pieces}
        </BoutonOnglet>
        {kycDispo && (
          <BoutonOnglet actif={onglet === 'kyc'} onClick={() => setOnglet('kyc')}>
            {O.kyc}
          </BoutonOnglet>
        )}
        <BoutonOnglet actif={onglet === 'epargne'} onClick={() => setOnglet('epargne')}>
          {O.epargne}
        </BoutonOnglet>
      </div>
      <div className="p-4">
        {onglet === 'coordonnees' && <OngletCoordonnees tierId={fiche.id} />}
        {onglet === 'pieces' && <OngletPieces tierId={fiche.id} />}
        {onglet === 'epargne' && (
          <OngletComptesEpargne tierId={fiche.id} tierStatut={fiche.status} />
        )}
        {onglet === 'kyc' && (
          <OngletKyc
            tierId={fiche.id}
            individu={fiche.individu}
            riskLevel={fiche.risk_level}
            riskProvisional={Boolean(fiche.risk_provisional)}
          />
        )}
      </div>
    </section>
  )
}

function BoutonOnglet({
  actif,
  onClick,
  children,
}: {
  actif: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={actif}
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
        actif
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}

function RetourListe() {
  return (
    <Link
      to="/tiers"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> {T.retour}
    </Link>
  )
}

function DetailIndividu({ detail }: { detail: NonNullable<FicheTier['individu']> }) {
  return (
    <>
      <Ligne label={T.dateNaissance} valeur={formaterDate(detail.birth_date)} icone={CalendarDays} />
      <Ligne
        label={T.sexe}
        valeur={detail.gender === 'M' ? LIBELLES.tiersCreation.sexeM : LIBELLES.tiersCreation.sexeF}
        icone={Venus}
      />
      <Ligne label={T.profession} valeur={detail.profession} icone={Briefcase} />
    </>
  )
}

function DetailMorale({ detail }: { detail: NonNullable<FicheTier['personne_morale']> }) {
  return (
    <>
      <Ligne
        label={T.formeJuridique}
        valeur={LIBELLES.tiersCreation.formesJuridiques[detail.legal_form] ?? detail.legal_form}
        icone={Building2}
      />
      <Ligne
        label={T.dateConstitution}
        valeur={formaterDate(detail.constitution_date)}
        icone={CalendarDays}
      />
    </>
  )
}

function DetailGroupement({ detail }: { detail: NonNullable<FicheTier['groupement']> }) {
  return (
    <>
      <Ligne
        label={T.typeGroupement}
        valeur={LIBELLES.tiersCreation.typesGroupement[detail.group_type] ?? detail.group_type}
        icone={UserRound}
      />
      <Ligne
        label={T.dateConstitution}
        valeur={formaterDate(detail.constitution_date)}
        icone={CalendarDays}
      />
    </>
  )
}

// Icône + ton par nature d'événement : le point de la frise se colore selon le sens de l'acte
// (création/réactivation vert, suspension/désactivation rouge, reste neutre) — jamais la couleur
// seule, l'icône et le libellé portent aussi le sens.
const EVENEMENT_META: Record<string, { icone: Icone; ton: 'success' | 'danger' | 'brand' | 'neutral' }> =
  {
    created: { icone: FilePlus2, ton: 'brand' },
    updated: { icone: PencilLine, ton: 'neutral' },
    activated: { icone: CheckCircle2, ton: 'success' },
    suspended: { icone: PauseCircle, ton: 'danger' },
    reactivated: { icone: PlayCircle, ton: 'success' },
    deactivated: { icone: Ban, ton: 'danger' },
    restored: { icone: RotateCcw, ton: 'success' },
    marked_deceased: { icone: UserRound, ton: 'neutral' },
    marked_dissolved: { icone: Building2, ton: 'neutral' },
    merged: { icone: Tag, ton: 'neutral' },
  }

const TON_TEXTE: Record<string, string> = {
  success: 'bg-success-subtle text-success',
  danger: 'bg-danger-subtle text-danger',
  brand: 'bg-brand-subtle text-brand',
  neutral: 'bg-muted text-muted-foreground',
}

function SectionTimeline({
  requete,
}: {
  requete: ReturnType<typeof useQuery<EvenementTimeline[], Error>>
}) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">{T.timeline}</h2>
      {requete.isSuccess && requete.data.length === 0 && (
        <p className="text-sm text-muted-foreground">{T.timelineVide}</p>
      )}
      {requete.isSuccess && requete.data.length > 0 && (
        <ol className="space-y-4">
          {requete.data.map((ev, i) => {
            const meta = EVENEMENT_META[ev.event_type] ?? { icone: PencilLine, ton: 'neutral' }
            const Icone = meta.icone
            return (
              <li key={i} className="flex gap-3 text-sm">
                <span
                  className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${TON_TEXTE[meta.ton]}`}
                  aria-hidden
                >
                  <Icone className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="font-medium">{G.evenements[ev.event_type] ?? ev.event_type}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(ev.occurred_at).toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {ev.auteur_nom && <> — {ev.auteur_nom}</>}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
