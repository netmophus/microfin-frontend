import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { useState, type ReactNode } from 'react'

import { SelecteurCompte } from '@/components/comptabilite/selecteur-compte'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAPermission } from '@/features/auth/useProfil'
import {
  lireParametresCaisse,
  modifierParametresCaisse,
  type ParametresCaisse,
} from '@/features/caisse/api'
import { messageRefusCompte } from '@/features/comptabilite/api'
import { formatFcfa } from '@/features/epargne/api'
import { LIBELLES } from '@/libelles/fr'

const P = LIBELLES.parametresCaisse

/**
 * Seuil de tolérance de caisse (CA2) + rattachement comptable de l'écart (CA3) : une seule
 * ligne de config, même patron que `PageParametresParts` — lecture par défaut, formulaire
 * complet en édition. Ne pilote jamais un blocage : au-delà du seuil, un motif devient exigé
 * à la fermeture d'une session (voir `PageCaisse`) ; sans compte rattaché, la VALIDATION de
 * l'écart par le responsable est refusée proprement (422), la fermeture elle-même n'est
 * jamais empêchée.
 */
export function PageParametresCaisse() {
  const client = useQueryClient()
  const [enEdition, setEnEdition] = useState(false)
  const peutGerer = useAPermission('compta.plan.manage')

  const config = useQuery({
    queryKey: ['comptabilite', 'parametres-caisse'],
    queryFn: lireParametresCaisse,
    retry: false,
  })

  const rafraichir = () => {
    setEnEdition(false)
    void client.invalidateQueries({ queryKey: ['comptabilite', 'parametres-caisse'] })
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{P.titre}</h1>
        <p className="text-sm text-muted-foreground">{P.sousTitre}</p>
      </div>

      <Alert>
        <AlertDescription>{P.avertissement}</AlertDescription>
      </Alert>

      {config.isPending ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{P.chargement}</p>
      ) : config.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {config.error instanceof AxiosError && config.error.response?.status === 403
              ? P.interdit
              : config.error instanceof AxiosError && config.error.response?.status === 404
                ? P.nonParametre
                : P.erreur}
          </AlertDescription>
        </Alert>
      ) : enEdition ? (
        <FormulaireEdition
          config={config.data}
          onFini={rafraichir}
          onAnnuler={() => setEnEdition(false)}
        />
      ) : (
        <Lecture config={config.data} peutGerer={peutGerer} onModifier={() => setEnEdition(true)} />
      )}
    </div>
  )
}

function Ligne({ label, valeur }: { label: string; valeur: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-2 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{valeur}</dd>
    </div>
  )
}

function TexteCompte({ compte }: { compte: { account_number: string; name: string } | null }) {
  if (!compte) return <span className="text-muted-foreground">{P.aucun}</span>
  return (
    <span className="font-mono text-xs">
      {compte.account_number} — {compte.name}
    </span>
  )
}

function Lecture({
  config,
  peutGerer,
  onModifier,
}: {
  config: ParametresCaisse
  peutGerer: boolean
  onModifier: () => void
}) {
  return (
    <div className="space-y-4 rounded-md border p-4">
      {config.is_provisional && (
        <div title={P.provisoireAide}>
          <Badge ton="warning">{P.provisoire}</Badge>
        </div>
      )}
      <dl>
        <Ligne
          label={P.seuil}
          valeur={<span className="tabular-nums">{formatFcfa(config.seuil_tolerance)}</span>}
        />
        <Ligne label={P.compteManquant} valeur={<TexteCompte compte={config.compte_ecart_manquant} />} />
        <Ligne label={P.compteExcedent} valeur={<TexteCompte compte={config.compte_ecart_excedent} />} />
        <Ligne label={P.compteTransit} valeur={<TexteCompte compte={config.compte_transit} />} />
        <Ligne
          label={P.compteEcartTransfertManquant}
          valeur={<TexteCompte compte={config.compte_ecart_transfert_manquant} />}
        />
        <Ligne
          label={P.compteEcartTransfertExcedent}
          valeur={<TexteCompte compte={config.compte_ecart_transfert_excedent} />}
        />
      </dl>
      {(config.compte_ecart_manquant === null || config.compte_ecart_excedent === null) && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{P.rattachementIncomplet}</AlertDescription>
        </Alert>
      )}
      {config.compte_transit === null && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{P.rattachementTransfertsIncomplet}</AlertDescription>
        </Alert>
      )}
      {peutGerer && (
        <Button size="sm" variant="outline" onClick={onModifier}>
          {P.modifier}
        </Button>
      )}
    </div>
  )
}

function FormulaireEdition({
  config,
  onFini,
  onAnnuler,
}: {
  config: ParametresCaisse
  onFini: () => void
  onAnnuler: () => void
}) {
  const [seuil, setSeuil] = useState(String(config.seuil_tolerance))
  const [compteManquant, setCompteManquant] = useState(
    config.compte_ecart_manquant?.account_number ?? null,
  )
  const [compteExcedent, setCompteExcedent] = useState(
    config.compte_ecart_excedent?.account_number ?? null,
  )
  const [compteTransit, setCompteTransit] = useState(
    config.compte_transit?.account_number ?? null,
  )
  const [compteEcartTransfertManquant, setCompteEcartTransfertManquant] = useState(
    config.compte_ecart_transfert_manquant?.account_number ?? null,
  )
  const [compteEcartTransfertExcedent, setCompteEcartTransfertExcedent] = useState(
    config.compte_ecart_transfert_excedent?.account_number ?? null,
  )
  const [motif, setMotif] = useState('')

  const seuilValide = /^\d+$/.test(seuil.trim())
  const motifValide = motif.trim().length >= 3
  const valide = seuilValide && motifValide

  const mutation = useMutation({
    mutationFn: () =>
      modifierParametresCaisse(
        Number(seuil),
        compteManquant,
        compteExcedent,
        compteTransit,
        compteEcartTransfertManquant,
        compteEcartTransfertExcedent,
        motif.trim(),
      ),
    onSuccess: onFini,
  })

  return (
    <form
      className="space-y-3 rounded-md border bg-brand-subtle/40 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (valide) mutation.mutate()
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="pc-seuil">{P.seuil}</Label>
        <Input
          id="pc-seuil"
          inputMode="numeric"
          value={seuil}
          onChange={(e) => setSeuil(e.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SelecteurCompte
          id="pc-manquant"
          label={P.compteManquant}
          filtre="saisie"
          valeur={compteManquant}
          onChange={setCompteManquant}
          libelleInitial={
            config.compte_ecart_manquant
              ? `${config.compte_ecart_manquant.account_number} — ${config.compte_ecart_manquant.name}`
              : null
          }
        />
        <SelecteurCompte
          id="pc-excedent"
          label={P.compteExcedent}
          filtre="saisie"
          valeur={compteExcedent}
          onChange={setCompteExcedent}
          libelleInitial={
            config.compte_ecart_excedent
              ? `${config.compte_ecart_excedent.account_number} — ${config.compte_ecart_excedent.name}`
              : null
          }
        />
      </div>

      {/* Sous-chantier 2 (transferts), Lot 2b : pont comptable des transferts — même garde-fou
          (compte de saisie actif) que les 2 champs ci-dessus, délibérément SANS contrainte de
          rubrique 1011 (voir aide sous le champ). */}
      <div className="space-y-1">
        <SelecteurCompte
          id="pc-transit"
          label={P.compteTransit}
          filtre="saisie"
          valeur={compteTransit}
          onChange={setCompteTransit}
          libelleInitial={
            config.compte_transit
              ? `${config.compte_transit.account_number} — ${config.compte_transit.name}`
              : null
          }
        />
        <p className="text-xs text-muted-foreground">{P.compteTransitAide}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SelecteurCompte
          id="pc-ecart-transfert-manquant"
          label={P.compteEcartTransfertManquant}
          filtre="saisie"
          valeur={compteEcartTransfertManquant}
          onChange={setCompteEcartTransfertManquant}
          libelleInitial={
            config.compte_ecart_transfert_manquant
              ? `${config.compte_ecart_transfert_manquant.account_number} — ${config.compte_ecart_transfert_manquant.name}`
              : null
          }
        />
        <SelecteurCompte
          id="pc-ecart-transfert-excedent"
          label={P.compteEcartTransfertExcedent}
          filtre="saisie"
          valeur={compteEcartTransfertExcedent}
          onChange={setCompteEcartTransfertExcedent}
          libelleInitial={
            config.compte_ecart_transfert_excedent
              ? `${config.compte_ecart_transfert_excedent.account_number} — ${config.compte_ecart_transfert_excedent.name}`
              : null
          }
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="pc-motif">{P.motif}</Label>
        <Input
          id="pc-motif"
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder={P.motifPlaceholder}
        />
      </div>

      {mutation.isError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{messageRefusCompte(mutation.error, P.echec)}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!valide || mutation.isPending}>
          {mutation.isPending ? P.enregistrementEnCours : P.enregistrer}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onAnnuler}>
          {P.annuler}
        </Button>
      </div>
    </form>
  )
}
