import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { useState, type ReactNode } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAPermission } from '@/features/auth/useProfil'
import {
  lireParametresParts,
  listerComptesSelecteur,
  messageRefusCompte,
  modifierParametresParts,
  type CompteSelecteur,
  type ParametresParts,
} from '@/features/comptabilite/api'
import { LIBELLES } from '@/libelles/fr'

const P = LIBELLES.parametresParts

/**
 * Paramètres d'institution des parts sociales (Bloc 5) : une seule ligne de config, pas une
 * liste. Lecture par défaut, formulaire complet en édition (tous les champs soumis ensemble,
 * comme les autres écrans de rattachement du bloc).
 */
export function PageParametresParts() {
  const client = useQueryClient()
  const [enEdition, setEnEdition] = useState(false)
  const peutGerer = useAPermission('compta.plan.manage')

  const config = useQuery({
    queryKey: ['comptabilite', 'parametres-parts'],
    queryFn: lireParametresParts,
    retry: false,
  })
  const comptes = useQuery({
    queryKey: ['comptabilite', 'comptes-selecteur'],
    queryFn: () => listerComptesSelecteur(),
    enabled: peutGerer,
  })

  const rafraichir = () => {
    setEnEdition(false)
    void client.invalidateQueries({ queryKey: ['comptabilite', 'parametres-parts'] })
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
      ) : enEdition && comptes.data ? (
        <FormulaireEdition
          config={config.data}
          comptes={comptes.data}
          onFini={rafraichir}
          onAnnuler={() => setEnEdition(false)}
        />
      ) : (
        <Lecture
          config={config.data}
          peutGerer={peutGerer}
          onModifier={() => setEnEdition(true)}
        />
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
  config: ParametresParts
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
        <Ligne label={P.valeurPart} valeur={`${config.unit_value.toLocaleString('fr-FR')} FCFA`} />
        <Ligne label={P.minimumParts} valeur={config.minimum_shares} />
        <Ligne label={P.remboursable} valeur={config.is_refundable ? 'Oui' : 'Non'} />
        <Ligne
          label={P.momentAdhesion}
          valeur={config.membership_on === 'souscription' ? P.momentSouscription : P.momentLiberation}
        />
        <Ligne label={P.compteLiberees} valeur={<TexteCompte compte={config.compte_parts_liberees} />} />
        <Ligne
          label={P.compteNonLiberees}
          valeur={<TexteCompte compte={config.compte_parts_non_liberees} />}
        />
      </dl>
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
  comptes,
  onFini,
  onAnnuler,
}: {
  config: ParametresParts
  comptes: CompteSelecteur[]
  onFini: () => void
  onAnnuler: () => void
}) {
  const [unitValue, setUnitValue] = useState(String(config.unit_value))
  const [minimumShares, setMinimumShares] = useState(String(config.minimum_shares))
  const [isRefundable, setIsRefundable] = useState(config.is_refundable)
  const [membershipOn, setMembershipOn] = useState(config.membership_on)
  const [compteLiberees, setCompteLiberees] = useState(
    config.compte_parts_liberees?.account_number ?? null,
  )
  const [compteNonLiberees, setCompteNonLiberees] = useState(
    config.compte_parts_non_liberees?.account_number ?? null,
  )
  const [motif, setMotif] = useState('')

  const unitValueValide = /^\d+$/.test(unitValue.trim())
  const minimumSharesValide = /^\d+$/.test(minimumShares.trim()) && Number(minimumShares) >= 1
  const motifValide = motif.trim().length >= 3
  const valide = unitValueValide && minimumSharesValide && motifValide

  const mutation = useMutation({
    mutationFn: () =>
      modifierParametresParts({
        unit_value: Number(unitValue),
        minimum_shares: Number(minimumShares),
        is_refundable: isRefundable,
        membership_on: membershipOn,
        compte_parts_liberees: compteLiberees,
        compte_parts_non_liberees: compteNonLiberees,
        motif: motif.trim(),
      }),
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
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="pp-valeur">{P.valeurPart}</Label>
          <Input
            id="pp-valeur"
            inputMode="numeric"
            value={unitValue}
            onChange={(e) => setUnitValue(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pp-minimum">{P.minimumParts}</Label>
          <Input
            id="pp-minimum"
            inputMode="numeric"
            value={minimumShares}
            onChange={(e) => setMinimumShares(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pp-moment">{P.momentAdhesion}</Label>
          <select
            id="pp-moment"
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            value={membershipOn}
            onChange={(e) => setMembershipOn(e.target.value as 'souscription' | 'liberation')}
          >
            <option value="souscription">{P.momentSouscription}</option>
            <option value="liberation">{P.momentLiberation}</option>
          </select>
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={isRefundable}
              onChange={(e) => setIsRefundable(e.target.checked)}
            />
            {P.remboursable}
          </label>
        </div>
        <div className="space-y-1">
          <Label htmlFor="pp-liberees">{P.compteLiberees}</Label>
          <select
            id="pp-liberees"
            className="h-9 w-full rounded-md border bg-background px-2 text-xs"
            value={compteLiberees ?? ''}
            onChange={(e) => setCompteLiberees(e.target.value || null)}
          >
            <option value="">{P.aucun}</option>
            {comptes.map((c) => (
              <option key={c.id} value={c.account_number}>
                {c.account_number} — {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="pp-non-liberees">{P.compteNonLiberees}</Label>
          <select
            id="pp-non-liberees"
            className="h-9 w-full rounded-md border bg-background px-2 text-xs"
            value={compteNonLiberees ?? ''}
            onChange={(e) => setCompteNonLiberees(e.target.value || null)}
          >
            <option value="">{P.aucun}</option>
            {comptes.map((c) => (
              <option key={c.id} value={c.account_number}>
                {c.account_number} — {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="pp-motif">{P.motif}</Label>
        <Input
          id="pp-motif"
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
