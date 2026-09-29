import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { ArrowRightLeft } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAPermission } from '@/features/auth/useProfil'
import {
  NIVEAUX_ADJACENTS,
  initierTransfert,
  listerMesPostes,
  listerTransferts,
  messageRefusCaisse,
  receptionnerTransfert,
  type NiveauTransfert,
  type PosteAssigne,
  type StatutTransfert,
  type Transfert,
} from '@/features/caisse/api'
import { formatFcfa } from '@/features/epargne/api'
import { LIBELLES } from '@/libelles/fr'

const T = LIBELLES.transfertsCaisse
const NIVEAUX: readonly NiveauTransfert[] = ['coffre', 'principale', 'secondaire']

function fmt(gabarit: string, valeurs: Record<string, string>): string {
  return gabarit.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '')
}

/** Chaîne saisie -> entier non négatif, ou NaN si vide — même convention que la fermeture de
 * caisse (PageCaisse.tsx::versEntier). */
function versEntier(valeur: string): number {
  const nettoye = valeur.replace(/\D/g, '')
  return nettoye === '' ? Number.NaN : Number.parseInt(nettoye, 10)
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

function libelleNiveau(niveau: NiveauTransfert): string {
  if (niveau === 'coffre') return T.niveauCoffre
  if (niveau === 'principale') return T.niveauPrincipale
  return T.niveauSecondaire
}

/** L'écart n'est JAMAIS porté par la seule couleur : le sens (excédent/manquant/nul) est
 * toujours écrit en toutes lettres, avec le montant — même règle que PageCaisse.tsx. */
function texteEcart(ecart: number): string {
  if (ecart === 0) return T.ecartNul
  if (ecart > 0) return fmt(T.ecartExcedent, { montant: formatFcfa(ecart) })
  return fmt(T.ecartManquant, { montant: formatFcfa(Math.abs(ecart)) })
}

/** Colonne Écart du tableau (Lot 2c) : compact, visible SEULEMENT s'il y en a un — « — » sinon
 * (pas encore réceptionné, ou montant compté strictement égal au montant envoyé). Le sens
 * (manquant/excédent) reste toujours écrit en toutes lettres, jamais la seule couleur. */
function texteEcartColonne(transfert: Transfert): string {
  if (transfert.montant_compte === null) return '—'
  const ecart = transfert.montant_compte - transfert.montant_envoye
  if (ecart === 0) return '—'
  return ecart > 0
    ? fmt(T.ecartExcedent, { montant: formatFcfa(ecart) })
    : fmt(T.ecartManquant, { montant: formatFcfa(Math.abs(ecart)) })
}

/**
 * Transferts de fonds entre niveaux de caisse ADJACENTS (coffre↔principale, principale↔
 * secondaire — jamais coffre↔secondaire direct, voir `NIVEAUX_ADJACENTS`). Un seul écran, trois
 * usages — même patron que PagePostes.tsx (liste + panneaux d'édition en ligne, pas trois
 * routes séparées) :
 *   - « Initier » : panneau au-dessus du tableau, visible seulement avec caisse.transfert.initier.
 *   - Le tableau EST l'écran « transferts » : « en transit » par défaut (la file d'attente à
 *     réceptionner), filtrable par statut (Lot 2c : un transfert réceptionné reste consultable
 *     — besoin d'audit, en LECTURE SEULE, jamais de ré-action possible) et par niveau.
 *   - « Réceptionner » : panneau déplié sous la ligne concernée, visible seulement avec
 *     caisse.transfert.valider, et SEULEMENT sur un transfert encore « en transit ». L'écart
 *     (compté != envoyé) est calculé ICI, en direct — le serveur ne le stocke jamais comme un
 *     champ séparé.
 *
 * Double regard (receveur != envoyeur) : pas de masquage du bouton (le serveur ne renvoie que
 * des noms, pas l'identité de l'acteur courant — comparer nécessiterait de faire remonter
 * l'identifiant de l'envoyeur jusqu'ici, hors périmètre de ce lot) — le refus, s'il survient,
 * s'affiche proprement via `messageRefusCaisse`, comme toute autre erreur métier de cet écran.
 */
export function PageTransfertsCaisse() {
  const client = useQueryClient()
  const [filtreNiveau, setFiltreNiveau] = useState<NiveauTransfert | 'tous'>('tous')
  const [filtreStatut, setFiltreStatut] = useState<StatutTransfert>('en_transit')
  const [initiationOuverte, setInitiationOuverte] = useState(false)
  const [receptionEnCours, setReceptionEnCours] = useState<string | null>(null)
  const peutInitier = useAPermission('caisse.transfert.initier')
  const peutValider = useAPermission('caisse.transfert.valider')

  const transferts = useQuery({
    queryKey: ['caisse', 'transferts', filtreStatut, filtreNiveau],
    queryFn: () =>
      listerTransferts({
        statut: filtreStatut,
        niveau: filtreNiveau === 'tous' ? undefined : filtreNiveau,
      }),
  })

  const messageListeVide =
    filtreStatut === 'en_transit'
      ? T.listeVideEnTransit
      : filtreStatut === 'receptionne'
        ? T.listeVideReceptionne
        : T.listeVideTous

  const rafraichir = () => {
    setInitiationOuverte(false)
    setReceptionEnCours(null)
    void client.invalidateQueries({ queryKey: ['caisse', 'transferts'] })
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <ArrowRightLeft className="size-5 text-muted-foreground" />
            {T.titre}
          </h1>
          <p className="text-sm text-muted-foreground">{T.sousTitre}</p>
        </div>
        {peutInitier && !initiationOuverte && (
          <Button size="sm" onClick={() => setInitiationOuverte(true)}>
            {T.initier}
          </Button>
        )}
      </header>

      {initiationOuverte && (
        <PanneauInitiation onFini={rafraichir} onAnnuler={() => setInitiationOuverte(false)} />
      )}

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <Label htmlFor="filtre-statut">{T.filtreStatut}</Label>
          <select
            id="filtre-statut"
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={filtreStatut}
            onChange={(e) => setFiltreStatut(e.target.value as StatutTransfert)}
          >
            <option value="en_transit">{T.filtreStatutEnTransit}</option>
            <option value="receptionne">{T.filtreStatutReceptionne}</option>
            <option value="tous">{T.filtreTous}</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="filtre-niveau">{T.filtreNiveau}</Label>
          <select
            id="filtre-niveau"
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={filtreNiveau}
            onChange={(e) => setFiltreNiveau(e.target.value as NiveauTransfert | 'tous')}
          >
            <option value="tous">{T.filtreTous}</option>
            {NIVEAUX.map((n) => (
              <option key={n} value={n}>
                {libelleNiveau(n)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {transferts.isPending ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{T.chargement}</p>
      ) : transferts.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {transferts.error instanceof AxiosError && transferts.error.response?.status === 403
              ? T.interdit
              : T.erreur}
          </AlertDescription>
        </Alert>
      ) : transferts.data.lignes.length === 0 ? (
        <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
          {messageListeVide}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{T.colonneMouvement}</th>
                <th className="px-3 py-2 text-right font-medium">{T.colonneMontantEnvoye}</th>
                <th className="px-3 py-2 text-right font-medium">{T.colonneMontantCompte}</th>
                <th className="px-3 py-2 text-right font-medium">{T.colonneEcart}</th>
                <th className="px-3 py-2 text-left font-medium">{T.colonneMotif}</th>
                <th className="px-3 py-2" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {transferts.data.lignes.map((t) => (
                <LigneTransfertRow
                  key={t.id}
                  transfert={t}
                  enReception={receptionEnCours === t.id}
                  peutValider={peutValider}
                  onOuvrirReception={() => setReceptionEnCours(t.id)}
                  onAnnulerReception={() => setReceptionEnCours(null)}
                  onFini={rafraichir}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function PanneauInitiation({ onFini, onAnnuler }: { onFini: () => void; onAnnuler: () => void }) {
  const [niveauSource, setNiveauSource] = useState<NiveauTransfert>('coffre')
  const [niveauDestination, setNiveauDestination] = useState<NiveauTransfert>(
    NIVEAUX_ADJACENTS.coffre[0],
  )
  const [posteId, setPosteId] = useState('')
  const [montant, setMontant] = useState('')
  const [montantErreur, setMontantErreur] = useState<string | null>(null)
  const [motif, setMotif] = useState('')

  const posteRequis = niveauSource === 'secondaire' || niveauDestination === 'secondaire'
  const mesPostes = useQuery({
    queryKey: ['caisse', 'mes-postes'],
    queryFn: listerMesPostes,
    enabled: posteRequis,
  })

  const montantNum = versEntier(montant)
  const motifValide = motif.trim().length >= 3
  const posteValide = !posteRequis || posteId !== ''
  const valide = !Number.isNaN(montantNum) && montantNum > 0 && motifValide && posteValide

  const mutation = useMutation({
    mutationFn: () =>
      initierTransfert(
        niveauSource,
        niveauDestination,
        posteRequis ? posteId : null,
        montantNum,
        motif.trim(),
      ),
    onSuccess: onFini,
  })

  function changerSource(n: NiveauTransfert) {
    setNiveauSource(n)
    const destinations = NIVEAUX_ADJACENTS[n]
    if (!destinations.includes(niveauDestination)) {
      setNiveauDestination(destinations[0])
    }
    setPosteId('')
  }

  return (
    <div className="space-y-3 rounded-md border bg-brand-subtle/30 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="ti-source">{T.niveauSourceLabel}</Label>
          <select
            id="ti-source"
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            value={niveauSource}
            onChange={(e) => changerSource(e.target.value as NiveauTransfert)}
          >
            {NIVEAUX.map((n) => (
              <option key={n} value={n}>
                {libelleNiveau(n)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ti-destination">{T.niveauDestinationLabel}</Label>
          <select
            id="ti-destination"
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            value={niveauDestination}
            onChange={(e) => setNiveauDestination(e.target.value as NiveauTransfert)}
          >
            {NIVEAUX_ADJACENTS[niveauSource].map((n) => (
              <option key={n} value={n}>
                {libelleNiveau(n)}
              </option>
            ))}
          </select>
        </div>

        {posteRequis && (
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="ti-poste">{T.posteLabel}</Label>
            <select
              id="ti-poste"
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={posteId}
              onChange={(e) => setPosteId(e.target.value)}
            >
              <option value="">{T.choisirUnPoste}</option>
              {(mesPostes.data ?? []).map((p: PosteAssigne) => (
                <option key={p.id} value={p.id}>
                  {p.libelle} ({p.code})
                </option>
              ))}
            </select>
            {mesPostes.data?.length === 0 && (
              <p className="text-xs text-muted-foreground">{T.aucunPosteAssigne}</p>
            )}
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="ti-montant">{T.montantEnvoyeLabel}</Label>
          <Input
            id="ti-montant"
            inputMode="numeric"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            onBlur={() =>
              setMontantErreur(Number.isNaN(versEntier(montant)) ? T.montantErreur : null)
            }
            aria-invalid={montantErreur !== null}
          />
          {montantErreur && <p className="text-xs text-danger">{montantErreur}</p>}
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="ti-motif">{T.motif}</Label>
          <Input
            id="ti-motif"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder={T.motifPlaceholder}
          />
        </div>
      </div>

      {mutation.isError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {messageRefusCaisse(mutation.error, T.echecInitiation)}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!valide || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? T.envoiEnCours : T.envoyer}
        </Button>
        <Button size="sm" variant="ghost" onClick={onAnnuler} disabled={mutation.isPending}>
          {T.annuler}
        </Button>
      </div>
    </div>
  )
}

function LigneTransfertRow({
  transfert,
  enReception,
  peutValider,
  onOuvrirReception,
  onAnnulerReception,
  onFini,
}: {
  transfert: Transfert
  enReception: boolean
  peutValider: boolean
  onOuvrirReception: () => void
  onAnnulerReception: () => void
  onFini: () => void
}) {
  const closTerminee = transfert.statut === 'receptionne'

  return (
    <>
      <tr className="border-b last:border-0">
        <td className="px-3 py-2">
          <span className="font-medium">{libelleNiveau(transfert.niveau_source)}</span>
          {' → '}
          <span className="font-medium">{libelleNiveau(transfert.niveau_destination)}</span>
          <div className="text-xs text-muted-foreground">
            {T.envoyePar} {transfert.envoye_par_nom}, {dateHeure(transfert.envoye_le)}
          </div>
          {closTerminee && transfert.receptionne_par_nom && transfert.receptionne_le && (
            <div className="text-xs text-muted-foreground">
              {T.receptionnePar} {transfert.receptionne_par_nom},{' '}
              {dateHeure(transfert.receptionne_le)}
            </div>
          )}
        </td>
        <td className="px-3 py-2 text-right font-mono tabular-nums">
          {formatFcfa(transfert.montant_envoye)}
        </td>
        <td className="px-3 py-2 text-right font-mono tabular-nums">
          {transfert.montant_compte === null ? '—' : formatFcfa(transfert.montant_compte)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums">{texteEcartColonne(transfert)}</td>
        <td className="px-3 py-2">{transfert.motif}</td>
        <td className="px-3 py-2 text-right">
          {/* Un transfert clos est en LECTURE SEULE : jamais de bouton, jamais de ré-action. */}
          {peutValider && !enReception && !closTerminee && (
            <Button size="sm" variant="outline" onClick={onOuvrirReception}>
              {T.receptionner}
            </Button>
          )}
        </td>
      </tr>
      {enReception && (
        <PanneauReception transfert={transfert} onFini={onFini} onAnnuler={onAnnulerReception} />
      )}
    </>
  )
}

function PanneauReception({
  transfert,
  onFini,
  onAnnuler,
}: {
  transfert: Transfert
  onFini: () => void
  onAnnuler: () => void
}) {
  const [montant, setMontant] = useState('')
  const [montantErreur, setMontantErreur] = useState<string | null>(null)
  const montantNum = versEntier(montant)

  const mutation = useMutation({
    mutationFn: () => receptionnerTransfert(transfert.id, montantNum),
    onSuccess: onFini,
  })

  return (
    <tr className="border-b bg-warning-subtle/30 last:border-0">
      <td className="px-3 py-3 align-top" colSpan={6}>
        <p className="mb-2 text-sm">
          {libelleNiveau(transfert.niveau_source)} → {libelleNiveau(transfert.niveau_destination)}
          {' — '}
          <span className="font-mono tabular-nums">{formatFcfa(transfert.montant_envoye)}</span>
          {' envoyés'}
        </p>
        <div className="max-w-xs space-y-1">
          <Label htmlFor={`tr-${transfert.id}-montant`}>{T.montantCompteLabel}</Label>
          <Input
            id={`tr-${transfert.id}-montant`}
            inputMode="numeric"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            onBlur={() =>
              setMontantErreur(Number.isNaN(versEntier(montant)) ? T.montantCompteErreur : null)
            }
            aria-invalid={montantErreur !== null}
          />
          {montantErreur && <p className="text-xs text-danger">{montantErreur}</p>}
          {!Number.isNaN(montantNum) && (
            <p className="text-sm text-muted-foreground">
              {texteEcart(montantNum - transfert.montant_envoye)}
            </p>
          )}
        </div>

        {mutation.isError && (
          <Alert variant="destructive" role="alert" className="mt-3">
            <AlertDescription>
              {messageRefusCaisse(mutation.error, T.echecReception)}
            </AlertDescription>
          </Alert>
        )}

        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            disabled={Number.isNaN(montantNum) || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? T.receptionEnCours : T.confirmerReception}
          </Button>
          <Button size="sm" variant="ghost" onClick={onAnnuler} disabled={mutation.isPending}>
            {T.annuler}
          </Button>
        </div>
      </td>
    </tr>
  )
}
