import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Printer } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { lireSession } from '@/features/caisse/api'
import { formatFcfa } from '@/features/epargne/api'
import { LIBELLES } from '@/libelles/fr'

const L = LIBELLES.lettreExplication

function fmt(gabarit: string, valeurs: Record<string, string>): string {
  return gabarit.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '')
}

function dateHeure(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function dateDuJour(): string {
  return new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function Champ({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="flex justify-between gap-4 py-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{valeur}</dd>
    </div>
  )
}

function RetourManquants() {
  return (
    <Link
      to="/caisse/manquants"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> {LIBELLES.sessionsManquantes.titre}
    </Link>
  )
}

/**
 * Lettre de demande d'explication (manquant de caisse) — document IMPRIMABLE, régénérable à
 * tout moment : source unique de vérité = la session fermée elle-même (`lireSession`), rien
 * n'est stocké côté lettre. Jamais fabriquée pour un écart nul ou un excédent (garde-fou,
 * même en accédant directement par l'URL) — l'excédent est explicitement hors périmètre.
 *
 * IMPRESSION : même patron que l'aperçu d'échéancier crédit — `.zone-impression` (index.css)
 * isole le document du reste de la page ; l'en-tête et le bloc réponse/signatures sont
 * `hidden` à l'écran, `print:block`/`print:grid` sur le papier.
 */
export function PageLettreExplication() {
  const { id = '' } = useParams()

  const requete = useQuery({
    queryKey: ['caisse', 'session', id],
    queryFn: () => lireSession(id),
  })

  if (requete.isPending) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{L.chargement}</p>
  }

  if (requete.isError) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <RetourManquants />
        <Alert variant="destructive" role="alert">
          <AlertDescription>{L.erreur}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => requete.refetch()}>
          {L.reessayer}
        </Button>
      </div>
    )
  }

  const session = requete.data
  const manquant = session.status === 'fermee' && session.ecart !== null && session.ecart < 0

  if (!manquant) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <RetourManquants />
        <Alert role="status">
          <AlertDescription>{L.nonApplicable}</AlertDescription>
        </Alert>
      </div>
    )
  }

  const emiseLe = dateDuJour()
  const montantManquant = formatFcfa(Math.abs(session.ecart ?? 0))

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <RetourManquants />

      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{L.titre}</h1>
          <p className="text-sm text-muted-foreground">{L.intro}</p>
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="mr-1 size-4" />
          {L.imprimer}
        </Button>
      </header>

      <div role="note" className="rounded-md border border-warning/50 bg-warning-subtle/40 px-3 py-2 text-sm">
        {L.provisoireBanniere}
      </div>

      <div className="zone-impression space-y-4 rounded-md border p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">{L.nomInstitution}</h2>
          <p className="text-sm text-muted-foreground">{fmt(L.emiseLe, { date: emiseLe })}</p>
        </div>

        <p className="font-medium">{L.objet}</p>

        <dl className="space-y-1 text-sm">
          <Champ label={L.caissierLabel} valeur={session.caissier_nom} />
          <Champ label={L.agenceLabel} valeur={session.agency_nom} />
          <Champ label={L.compteLabel} valeur={session.compte_caisse_number} />
          <Champ label={L.ouvertureLabel} valeur={dateHeure(session.opened_at)} />
          <Champ label={L.fermetureLabel} valeur={session.closed_at ? dateHeure(session.closed_at) : '—'} />
        </dl>

        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {L.calculTitre}
          </p>
          <dl className="space-y-1 text-sm">
            <Champ label={L.fondsInitialLabel} valeur={formatFcfa(session.fonds_initial)} />
            <Champ
              label={L.soldeTheoriqueLabel}
              valeur={formatFcfa(session.solde_theorique_cloture ?? 0)}
            />
            <Champ
              label={L.montantCompteLabel}
              valeur={formatFcfa(session.montant_reel_cloture ?? 0)}
            />
            <div className="flex justify-between gap-4 border-t pt-1 text-base">
              <dt className="font-semibold">{L.ecartLabel}</dt>
              <dd className="text-right font-semibold text-danger">{montantManquant}</dd>
            </div>
          </dl>
        </div>

        <p className="text-sm">
          {fmt(L.texteFormel, { montant: montantManquant, date: emiseLe })}
        </p>

        <div className="hidden print:block">
          <p className="text-sm font-medium">{L.reponseTitre}</p>
          <div className="mt-2 h-32 rounded-md border" />
        </div>

        <div className="hidden print:grid print:grid-cols-2 print:gap-8 print:pt-10 print:text-sm">
          <div>
            <p>{L.signatureCaissier}</p>
            <div className="mt-10 border-t border-foreground" />
            <p className="mt-1 text-xs text-muted-foreground">{L.dateSignature}</p>
          </div>
          <div>
            <p>{L.signatureResponsable}</p>
            <div className="mt-10 border-t border-foreground" />
            <p className="mt-1 text-xs text-muted-foreground">{L.dateSignature}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
