import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Printer } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useAPermission } from '@/features/auth/useProfil'
import { demanderLettreExplication, lireSession } from '@/features/caisse/api'
import { ActionsDocument } from '@/features/documents/ActionsDocument'
import { ouvrirPdf, telechargerDocument, type DocumentRef } from '@/features/documents/api'
import { formatFcfa, formatJour, messageRefus } from '@/features/epargne/api'
import { LIBELLES } from '@/libelles/fr'

const L = LIBELLES.lettreExplication

function fmt(gabarit: string, valeurs: Record<string, string>): string {
  return gabarit.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '')
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
 * Lettre de demande d'explication (manquant de caisse) : le document est le PDF généré et archivé
 * par le serveur (une seule fois par session, les demandes suivantes rendent l'archive). Cet écran
 * en résume le contenu et propose « Télécharger la lettre ».
 *
 * Jamais proposée pour un écart nul ou un excédent (garde-fou, même en accédant directement par
 * l'URL — le serveur refuse aussi) : l'excédent est explicitement hors périmètre.
 */
export function PageLettreExplication() {
  const { id = '' } = useParams()
  const peutLireDocuments = useAPermission('documents.read')
  // Seule une génération en ÉCHEC garde sa référence : elle ouvre « Régénérer ».
  const [enEchec, setEnEchec] = useState<DocumentRef | null>(null)

  const requete = useQuery({
    queryKey: ['caisse', 'session', id],
    queryFn: () => lireSession(id),
  })

  const lettre = useMutation({
    mutationFn: async () => {
      const reference = await demanderLettreExplication(id)
      if (reference.statut === 'ok') {
        ouvrirPdf(await telechargerDocument(reference.id), reference.nom)
      }
      return reference
    },
    onSuccess: (reference) => setEnEchec(reference.statut === 'echec' ? reference : null),
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

  // Journée comptable de la SESSION (dérivée côté serveur) : jamais l'horloge du poste.
  const journeeSession = formatJour(session.journee_comptable)
  const montantManquant = formatFcfa(Math.abs(session.ecart ?? 0))

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <RetourManquants />

      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{L.titre}</h1>
          <p className="text-sm text-muted-foreground">{L.intro}</p>
        </div>
        {peutLireDocuments && !enEchec && (
          <Button variant="outline" disabled={lettre.isPending} onClick={() => lettre.mutate()}>
            <Printer className="mr-1 size-4" />
            {lettre.isPending ? L.preparation : L.telecharger}
          </Button>
        )}
      </header>

      {lettre.isError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{messageRefus(lettre.error, L.lettreEchec)}</AlertDescription>
        </Alert>
      )}
      {enEchec && <ActionsDocument reference={enEchec} objet="lettre" />}
      {!peutLireDocuments && (
        <Alert role="status">
          <AlertDescription>{L.accesDocumentsRefuse}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4 rounded-md border p-6">
        <p className="text-sm text-muted-foreground">{fmt(L.journeeSession, { date: journeeSession })}</p>

        <p className="font-medium">{L.objet}</p>

        <dl className="space-y-1 text-sm">
          <Champ label={L.caissierLabel} valeur={session.caissier_nom} />
          <Champ label={L.agenceLabel} valeur={session.agency_nom} />
          <Champ label={L.compteLabel} valeur={session.compte_caisse_number} />
        </dl>

        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {L.calculTitre}
          </p>
          <dl className="space-y-1 text-sm">
            <Champ label={L.fondsInitialLabel} valeur={formatFcfa(session.fonds_initial)} />
            <Champ label={L.soldeTheoriqueLabel} valeur={formatFcfa(session.solde_theorique_cloture ?? 0)} />
            <Champ label={L.montantCompteLabel} valeur={formatFcfa(session.montant_reel_cloture ?? 0)} />
            <div className="flex justify-between gap-4 border-t pt-1 text-base">
              <dt className="font-semibold">{L.ecartLabel}</dt>
              <dd className="text-right font-semibold text-danger">{montantManquant}</dd>
            </div>
          </dl>
        </div>

        <p className="text-sm">{fmt(L.texteFormel, { montant: montantManquant, date: journeeSession })}</p>
      </div>
    </div>
  )
}
