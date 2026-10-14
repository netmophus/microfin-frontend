import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAPermission } from '@/features/auth/useProfil'
import {
  apercuDenouement,
  denouerDepotATerme,
  formatFcfa,
  formatJour,
  formatTaux,
  messageRefus,
  ouvrirDepotATerme,
  retirerParAnticipation,
  simulerDepotATerme,
  listerProduits,
  type CompteGuichet,
  type ProduitEpargne,
  type ResultatDenouement,
  type ResultatOuvertureDepotATerme,
} from '@/features/epargne/api'
import { listerTiers, type LigneTier } from '@/features/tiers/api'
import { ActionsDocument } from '@/features/documents/ActionsDocument'
import { parseMontantFrancs } from '@/lib/montants'
import { LIBELLES } from '@/libelles/fr'

const D = LIBELLES.depotATerme

const RACCOURCIS_MOIS = [3, 6, 12, 24] as const

function fmt(gabarit: string, valeurs: Record<string, string>): string {
  return gabarit.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '')
}

/** Durée en mois entiers dans les bornes du produit ; null si vide, invalide ou hors bornes. */
function parseDuree(saisie: string, min: number, max: number): number | null {
  const propre = saisie.trim()
  if (!/^\d+$/.test(propre)) return null
  const mois = Number(propre)
  return mois >= min && mois <= max ? mois : null
}

/**
 * Ouverture d'un dépôt à terme AU GUICHET (caissier) : durée choisie (raccourcis 3/6/12/24 dans
 * les bornes du produit, ou nombre de mois libre), capital, puis SIMULATION — échéance et
 * intérêts attendus — à montrer au client avant de valider. L'ouverture place le capital en
 * espèces dans la même opération : jamais de dépôt à terme vide.
 */
export function FormulaireDepotATerme({
  tierId,
  membreNom,
  produit,
  onFini,
  onAnnuler,
}: {
  tierId: string
  membreNom: string
  produit: ProduitEpargne
  onFini: (message: string, resultat: ResultatOuvertureDepotATerme) => void
  onAnnuler: () => void
}) {
  const client = useQueryClient()
  const [mois, setMois] = useState('')
  const [capital, setCapital] = useState('')
  const [confirmation, setConfirmation] = useState(false)

  const min = produit.duree_min_mois
  const max = produit.duree_max_mois
  const dureesParametrees = min !== null && max !== null
  const dureeValeur = dureesParametrees ? parseDuree(mois, min, max) : null
  const capitalValeur = parseMontantFrancs(capital)
  const capitalValide = capitalValeur !== null && capitalValeur > 0
  const dureeInvalide = mois.trim() !== '' && dureeValeur === null
  const capitalInvalide = capital.trim() !== '' && !capitalValide

  const demande =
    dureeValeur !== null && capitalValide
      ? { product_id: produit.id, term_months: dureeValeur, montant: capitalValeur }
      : null

  const simulation = useQuery({
    queryKey: ['epargne', 'simulation-dat', demande],
    queryFn: () => simulerDepotATerme(demande as NonNullable<typeof demande>),
    enabled: demande !== null,
  })

  const placement = useMutation({
    mutationFn: () => ouvrirDepotATerme(tierId, demande as NonNullable<typeof demande>),
    onSuccess: (resultat) => {
      void client.invalidateQueries({ queryKey: ['epargne', 'comptes', tierId] })
      onFini(
        fmt(D.placementFait, {
          numero: resultat.compte.account_number,
          echeance: formatJour(resultat.compte.maturity_date),
        }),
        resultat,
      )
    },
  })

  const bornes = { min: String(min ?? ''), max: String(max ?? '') }

  return (
    <form
      className="space-y-3 rounded-md border bg-brand-subtle/40 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (demande && simulation.isSuccess) setConfirmation(true)
      }}
    >
      <p className="text-sm font-medium">
        {D.titre} — {produit.name}
      </p>

      {!dureesParametrees ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{D.dureesNonParametrees}</AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="space-y-1">
            <Label htmlFor="dat-duree">{D.duree}</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="dat-duree"
                inputMode="numeric"
                className="w-28"
                value={mois}
                aria-invalid={dureeInvalide}
                aria-describedby="dat-duree-aide"
                onChange={(e) => {
                  setMois(e.target.value)
                  setConfirmation(false)
                }}
              />
              {RACCOURCIS_MOIS.filter((m) => m >= min && m <= max).map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant={dureeValeur === m ? 'default' : 'outline'}
                  onClick={() => {
                    setMois(String(m))
                    setConfirmation(false)
                  }}
                >
                  {D.raccourci(m)}
                </Button>
              ))}
            </div>
            <p id="dat-duree-aide" className="text-xs text-muted-foreground">
              {fmt(D.dureeAide, bornes)}
            </p>
            {dureeInvalide && <p className="text-xs text-destructive">{fmt(D.dureeInvalide, bornes)}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="dat-capital">{D.capital}</Label>
            <Input
              id="dat-capital"
              inputMode="numeric"
              value={capital}
              aria-invalid={capitalInvalide}
              onChange={(e) => {
                setCapital(e.target.value)
                setConfirmation(false)
              }}
            />
            {capitalInvalide && <p className="text-xs text-destructive">{LIBELLES.montantFrancsInvalide}</p>}
          </div>

          {demande && (
            <div className="space-y-1 rounded-md border bg-background p-3 text-sm" aria-live="polite">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {D.simulationTitre}
              </p>
              {simulation.isPending ? (
                <p className="text-muted-foreground">{D.simulationEnCours}</p>
              ) : simulation.isError ? (
                <p role="alert" className="text-destructive">
                  {messageRefus(simulation.error, D.simulationEchec)}
                </p>
              ) : (
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
                  <dt className="text-muted-foreground">{D.depart}</dt>
                  <dd className="font-mono tabular-nums">{formatJour(simulation.data.journee_comptable)}</dd>
                  <dt className="text-muted-foreground">{D.echeance}</dt>
                  <dd className="font-mono tabular-nums">{formatJour(simulation.data.maturity_date)}</dd>
                  <dt className="text-muted-foreground">{D.interets}</dt>
                  <dd className="font-mono tabular-nums">
                    {formatFcfa(simulation.data.interets_a_l_echeance)}
                  </dd>
                  <dt className="text-muted-foreground">{D.totalEcheance}</dt>
                  <dd className="font-mono font-semibold tabular-nums">
                    {formatFcfa(simulation.data.total_a_l_echeance)}
                  </dd>
                  <dt className="text-muted-foreground">{D.penalite}</dt>
                  <dd>
                    {fmt(D.penaliteValeur, {
                      pourcent: formatTaux(simulation.data.penalite_anticipee_bp),
                    })}
                  </dd>
                </dl>
              )}
            </div>
          )}
        </>
      )}

      <p className="text-xs text-muted-foreground">{D.sessionRequise}</p>

      {placement.isError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{messageRefus(placement.error, D.placementEchec)}</AlertDescription>
        </Alert>
      )}

      {confirmation && demande && simulation.isSuccess ? (
        <div className="space-y-3 rounded-md border bg-background p-3">
          <p className="text-sm font-semibold">
            {fmt(D.confirmerPlacement, {
              capital: formatFcfa(demande.montant),
              mois: String(demande.term_months),
              membre: membreNom,
              echeance: formatJour(simulation.data.maturity_date),
              interets: formatFcfa(simulation.data.interets_a_l_echeance),
            })}
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={placement.isPending} onClick={() => placement.mutate()}>
              {placement.isPending ? D.placementEnCours : D.confirmerPlacementBouton}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={placement.isPending}
              onClick={() => setConfirmation(false)}
            >
              {D.modifier}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={!simulation.isSuccess}>
            {D.continuer}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onAnnuler}>
            {D.annuler}
          </Button>
        </div>
      )}
    </form>
  )
}

/**
 * Guichet : le panneau d'un compte à terme. Dépôt et retrait ordinaires sont bloqués (le serveur
 * refuse, l'écran ne les propose pas). Selon la journée comptable, UNE seule issue est offerte :
 * le dénouement à l'échéance (acte de caisse), ou le retrait anticipé avec pénalité (responsable
 * seulement). Ce que recevrait le client est calculé par le serveur et montré AVANT confirmation.
 */
export function PanneauDepotATermeGuichet({
  compte,
  onSolde,
}: {
  compte: CompteGuichet
  onSolde: (nouveauSolde: number) => void
}) {
  const client = useQueryClient()
  const peutAnticiper = useAPermission('epargne.dat.retrait_anticipe')
  const [confirmation, setConfirmation] = useState(false)
  const [resultat, setResultat] = useState<ResultatDenouement | null>(null)

  const apercu = useQuery({
    queryKey: ['epargne', 'denouement-apercu', compte.id],
    queryFn: () => apercuDenouement(compte.id),
    enabled: resultat === null,
  })

  const mode = apercu.data?.mode
  const operation = useMutation({
    mutationFn: () =>
      mode === 'echeance' ? denouerDepotATerme(compte.id) : retirerParAnticipation(compte.id),
    onSuccess: (recu) => {
      setResultat(recu)
      setConfirmation(false)
      onSolde(0)
      void client.invalidateQueries({ queryKey: ['epargne', 'comptes'] })
      void client.invalidateQueries({ queryKey: ['epargne', 'recherche-comptes'] })
    },
  })

  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-brand-subtle/40 p-3 text-sm">
        <p className="font-medium">{fmt(D.bandeau, { echeance: formatJour(compte.maturity_date) })}</p>
        {compte.principal !== null && (
          <p className="text-muted-foreground">
            {fmt(D.capitalPlace, { capital: formatFcfa(compte.principal) })}
          </p>
        )}
        <p className="text-muted-foreground">{D.bloque}</p>
      </div>

      {resultat ? (
        <div className="space-y-3">
          <Alert role="status">
            <AlertDescription>
              {fmt(D.succes, {
                message: resultat.message,
                piece: resultat.entry_number ?? '—',
              })}
            </AlertDescription>
          </Alert>
          <ActionsDocument reference={resultat.document} objet="recu" />
        </div>
      ) : apercu.isPending ? (
        <p className="text-sm text-muted-foreground">{D.apercuChargement}</p>
      ) : apercu.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{messageRefus(apercu.error, D.apercuEchec)}</AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-3">
          <p className="text-sm">{apercu.data.mode === 'echeance' ? D.aLEcheance : D.avantEcheance}</p>
          <p className="rounded-md border bg-background p-3 text-sm font-medium">{apercu.data.message}</p>

          {apercu.data.mode === 'anticipe' && !peutAnticiper ? (
            <Alert role="note">
              <AlertDescription>{D.reserveResponsable}</AlertDescription>
            </Alert>
          ) : !confirmation ? (
            <Button type="button" onClick={() => setConfirmation(true)}>
              {apercu.data.mode === 'echeance' ? D.denouer : D.retraitAnticipe}
            </Button>
          ) : (
            <div className="space-y-3 rounded-md border bg-brand-subtle/40 p-3">
              <p className="text-sm font-semibold">
                {fmt(D.confirmation, {
                  total: formatFcfa(apercu.data.total_paye),
                  membre: compte.membre_nom,
                })}
              </p>
              {operation.isError && (
                <Alert variant="destructive" role="alert">
                  <AlertDescription>{messageRefus(operation.error, D.echec)}</AlertDescription>
                </Alert>
              )}
              <div className="flex gap-2">
                <Button onClick={() => operation.mutate()} disabled={operation.isPending}>
                  {operation.isPending
                    ? D.enCours
                    : apercu.data.mode === 'echeance'
                      ? D.denouerConfirmer
                      : D.retraitAnticipeConfirmer}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmation(false)}>
                  {D.annuler}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Guichet — ouvrir un dépôt à terme : le caissier choisit le MEMBRE (recherche par numéro ou nom),
 * puis le produit à terme, la durée et le capital ; simulation, confirmation (le nom du membre y
 * est rappelé), et le capital est encaissé dans la caisse de SA session. Le compte ordinaire,
 * lui, reste ouvert par le chargé de clientèle depuis la fiche.
 */
export function OuvertureDepotATermeGuichet({ onQuitter }: { onQuitter: () => void }) {
  const [membre, setMembre] = useState<LigneTier | null>(null)
  const [produitId, setProduitId] = useState('')
  const [fait, setFait] = useState<{
    message: string
    resultat: ResultatOuvertureDepotATerme
  } | null>(null)
  const [q, setQ] = useState('')

  const recherche = useMutation({ mutationFn: () => listerTiers({ q: q.trim() }) })
  const produits = useQuery({ queryKey: ['epargne', 'produits'], queryFn: listerProduits })
  const produitsTerme = (produits.data ?? []).filter((p) => p.type === 'terme')
  const produit = produitsTerme.find((p) => p.id === produitId)

  if (fait) {
    return (
      <div className="space-y-3">
        <Alert role="status">
          <AlertDescription>{fait.message}</AlertDescription>
        </Alert>
        <Button variant="ghost" onClick={onQuitter}>
          {D.retour}
        </Button>
        <ActionsDocument reference={fait.resultat.document} objet="recu" />
        <ActionsDocument reference={fait.resultat.bon} objet="bon" />
      </div>
    )
  }

  return (
    <section className="space-y-4 rounded-md border p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold">{D.ouvrirGuichet}</h2>
        <Button size="sm" variant="ghost" onClick={onQuitter}>
          {D.retour}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{D.introGuichet}</p>

      {!membre ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (q.trim()) recherche.mutate()
          }}
        >
          <Label htmlFor="recherche-membre-dat">{D.rechercherLabel}</Label>
          <div className="flex gap-2">
            <Input
              id="recherche-membre-dat"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={D.rechercherPlaceholder}
            />
            <Button type="submit" disabled={!q.trim() || recherche.isPending}>
              {recherche.isPending ? D.rechercheEnCours : D.chercher}
            </Button>
          </div>
          {recherche.isSuccess && recherche.data.lignes.length === 0 && (
            <Alert role="alert">
              <AlertDescription>{D.aucunMembre}</AlertDescription>
            </Alert>
          )}
          {recherche.isSuccess && recherche.data.lignes.length > 0 && (
            <ul className="divide-y rounded-md border bg-background text-sm">
              {recherche.data.lignes.map((ligne) => (
                <li key={ligne.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-muted/50"
                    onClick={() => setMembre(ligne)}
                  >
                    <span className="font-medium">{ligne.display_name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{ligne.tier_number}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>
      ) : (
        <div className="space-y-3">
          {/* Le NOM du membre en évidence : vérification humaine avant d'encaisser. */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{D.membre}</p>
              <p className="text-lg font-bold">{membre.display_name}</p>
              <p className="font-mono text-sm text-muted-foreground">{membre.tier_number}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setMembre(null)}>
              {D.changerMembre}
            </Button>
          </div>

          {membre.status !== 'actif' ? (
            <Alert role="note">
              <AlertDescription>{D.membreNonActif}</AlertDescription>
            </Alert>
          ) : produits.isSuccess && produitsTerme.length === 0 ? (
            <Alert role="note">
              <AlertDescription>{D.aucunProduitTerme}</AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="space-y-1">
                <Label htmlFor="produit-terme">{D.produitLabel}</Label>
                <select
                  id="produit-terme"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={produitId}
                  onChange={(e) => setProduitId(e.target.value)}
                >
                  <option value="">{D.produitChoisir}</option>
                  {produitsTerme.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              {produit && (
                <FormulaireDepotATerme
                  key={produit.id}
                  tierId={membre.id}
                  membreNom={membre.display_name}
                  produit={produit}
                  onFini={(message, resultat) => setFait({ message, resultat })}
                  onAnnuler={onQuitter}
                />
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}
