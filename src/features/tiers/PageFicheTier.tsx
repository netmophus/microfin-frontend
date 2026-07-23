import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAPermission } from '@/features/auth/useProfil'
import { ActionsTier } from '@/features/tiers/actions-tier'
import {
  ErreurFiche,
  lireTier,
  lireTimeline,
  type EvenementTimeline,
  type FicheTier,
} from '@/features/tiers/api'
import { listerAgences } from '@/features/utilisateurs/agences'
import { LIBELLES } from '@/libelles/fr'

const T = LIBELLES.tiersFiche
const G = LIBELLES.tiers

/** Nom d'affichage : depuis le bloc de détail (vue complète) ou display_name (vue résumée). */
function nomAffichage(fiche: FicheTier): string {
  if (fiche.individu) return `${fiche.individu.last_name} ${fiche.individu.first_name}`
  if (fiche.personne_morale) return fiche.personne_morale.legal_name
  if (fiche.groupement) return fiche.groupement.group_name
  return fiche.display_name ?? fiche.tier_number
}

function Statut({ code }: { code: string }) {
  const base = 'inline-block rounded px-2 py-0.5 text-xs font-medium'
  const style =
    code === 'actif'
      ? 'bg-emerald-100 text-emerald-800'
      : code === 'prospect'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-gray-100 text-gray-700'
  return <span className={`${base} ${style}`}>{G.statuts[code] ?? code}</span>
}

function Ligne({ label, valeur }: { label: string; valeur: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{valeur?.trim() ? valeur : T.sansValeur}</dd>
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
    <div className="mx-auto max-w-2xl space-y-5">
      <RetourListe />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{nomAffichage(fiche)}</h1>
          <p className="font-mono text-xs text-muted-foreground">{fiche.tier_number}</p>
        </div>
        <Statut code={fiche.status} />
      </div>

      {fiche.status === 'prospect' && (
        <Alert>
          <AlertDescription>
            <span className="font-medium">{T.prospectTitre}.</span> {T.prospectExplication}
          </AlertDescription>
        </Alert>
      )}

      <section className="rounded-md border p-4">
        <h2 className="mb-2 text-sm font-semibold">{T.identite}</h2>
        <dl className="divide-y">
          <Ligne label={T.type} valeur={G.types[fiche.tier_type] ?? fiche.tier_type} />
          <Ligne label={T.agence} valeur={nomAgence(fiche.primary_agency_id)} />
          {fiche.primary_phone !== undefined && (
            <Ligne label={T.telephone} valeur={fiche.primary_phone} />
          )}
          {fiche.individu && <DetailIndividu detail={fiche.individu} />}
          {fiche.personne_morale && <DetailMorale detail={fiche.personne_morale} />}
          {fiche.groupement && <DetailGroupement detail={fiche.groupement} />}
          {fiche.created_at && <Ligne label={T.creeLe} valeur={formaterDate(fiche.created_at)} />}
        </dl>

        {!aLeDetail && (
          <p className="mt-3 rounded bg-muted/40 p-2 text-xs text-muted-foreground">
            <span className="font-medium">{T.vueLimitee}.</span> {T.vueLimiteeAide}
          </p>
        )}
      </section>

      <ActionsTier tier={fiche} onChangement={rafraichir} />

      {peutVoirDetail && <SectionTimeline requete={timeline} />}
    </div>
  )
}

function RetourListe() {
  return (
    <Link to="/tiers" className="text-sm text-muted-foreground underline underline-offset-2">
      ← {T.retour}
    </Link>
  )
}

function DetailIndividu({ detail }: { detail: NonNullable<FicheTier['individu']> }) {
  return (
    <>
      <Ligne label={T.dateNaissance} valeur={formaterDate(detail.birth_date)} />
      <Ligne
        label={T.sexe}
        valeur={detail.gender === 'M' ? LIBELLES.tiersCreation.sexeM : LIBELLES.tiersCreation.sexeF}
      />
      <Ligne label={T.profession} valeur={detail.profession} />
    </>
  )
}

function DetailMorale({ detail }: { detail: NonNullable<FicheTier['personne_morale']> }) {
  return (
    <>
      <Ligne
        label={T.formeJuridique}
        valeur={LIBELLES.tiersCreation.formesJuridiques[detail.legal_form] ?? detail.legal_form}
      />
      <Ligne label={T.dateConstitution} valeur={formaterDate(detail.constitution_date)} />
    </>
  )
}

function DetailGroupement({ detail }: { detail: NonNullable<FicheTier['groupement']> }) {
  return (
    <>
      <Ligne
        label={T.typeGroupement}
        valeur={LIBELLES.tiersCreation.typesGroupement[detail.group_type] ?? detail.group_type}
      />
      <Ligne label={T.dateConstitution} valeur={formaterDate(detail.constitution_date)} />
    </>
  )
}

function SectionTimeline({
  requete,
}: {
  requete: ReturnType<typeof useQuery<EvenementTimeline[], Error>>
}) {
  return (
    <section className="rounded-md border p-4">
      <h2 className="mb-3 text-sm font-semibold">{T.timeline}</h2>
      {requete.isSuccess && requete.data.length === 0 && (
        <p className="text-sm text-muted-foreground">{T.timelineVide}</p>
      )}
      {requete.isSuccess && requete.data.length > 0 && (
        <ol className="space-y-3">
          {requete.data.map((ev, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                {new Date(ev.occurred_at).toLocaleString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <span>
                <span className="font-medium">{G.evenements[ev.event_type] ?? ev.event_type}</span>
                {ev.auteur_nom && (
                  <span className="text-muted-foreground"> — {ev.auteur_nom}</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
