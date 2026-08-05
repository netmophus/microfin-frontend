import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAPermission } from '@/features/auth/useProfil'
import {
  creerPalierSouffrance,
  listerComptesSelecteur,
  listerPaliersSouffrance,
  messageRefusCompte,
  modifierPalierSouffrance,
  retirerPalierSouffrance,
  type CompteSelecteur,
  type EcriturePalier,
  type PalierSouffrance,
} from '@/features/comptabilite/api'
import { formatTaux } from '@/features/epargne/api'
import { LIBELLES } from '@/libelles/fr'

const P = LIBELLES.paliersSouffrance

/**
 * Paliers de souffrance (CR5a, Bloc 5) — DIFFÉRENT des 3 autres écrans du bloc : le NOMBRE de
 * lignes est lui-même une donnée (créer/retirer un palier, pas seulement modifier une ligne
 * fixe). `seuil_jours` sert de clé de tri à l'affichage — pas de colonne « ordre » séparée.
 * Aucune reclassification automatique n'est branchée ici (CR5c, à venir) : paramétrage seul.
 */
export function PagePaliersSouffrance() {
  const client = useQueryClient()
  const [enEdition, setEnEdition] = useState<string | null>(null) // id du palier, ou 'nouveau'
  const [enSuppression, setEnSuppression] = useState<string | null>(null)
  const peutGerer = useAPermission('compta.plan.manage')

  const paliers = useQuery({
    queryKey: ['comptabilite', 'paliers-souffrance'],
    queryFn: listerPaliersSouffrance,
  })
  const comptes = useQuery({
    queryKey: ['comptabilite', 'comptes-selecteur'],
    queryFn: () => listerComptesSelecteur(),
    enabled: peutGerer,
  })

  const rafraichir = () => {
    setEnEdition(null)
    setEnSuppression(null)
    void client.invalidateQueries({ queryKey: ['comptabilite', 'paliers-souffrance'] })
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{P.titre}</h1>
        <p className="text-sm text-muted-foreground">{P.sousTitre}</p>
      </div>

      <Alert>
        <AlertDescription>{P.avertissement}</AlertDescription>
      </Alert>

      {paliers.isPending ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{P.chargement}</p>
      ) : paliers.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {paliers.error instanceof AxiosError && paliers.error.response?.status === 403
              ? P.interdit
              : P.erreur}
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {peutGerer && enEdition !== 'nouveau' && (
            <Button size="sm" onClick={() => setEnEdition('nouveau')}>
              {P.ajouter}
            </Button>
          )}

          {paliers.data.length === 0 && enEdition !== 'nouveau' && (
            <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
              {P.listeVide}
            </p>
          )}

          {(paliers.data.length > 0 || enEdition === 'nouveau') && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">{P.colonneLibelle}</th>
                    <th className="px-3 py-2 text-right font-medium">{P.colonneSeuil}</th>
                    <th className="px-3 py-2 text-right font-medium">{P.colonneTaux}</th>
                    <th className="px-3 py-2 text-left font-medium">{P.colonneEncours}</th>
                    <th className="px-3 py-2 text-left font-medium">{P.colonneDotation}</th>
                    {peutGerer && <th className="px-3 py-2" />}
                  </tr>
                </thead>
                <tbody>
                  {enEdition === 'nouveau' && comptes.data && (
                    <LigneEdition
                      comptes={comptes.data}
                      onFini={rafraichir}
                      onAnnuler={() => setEnEdition(null)}
                    />
                  )}
                  {paliers.data.map((palier) =>
                    enSuppression === palier.id ? (
                      <LigneSuppression
                        key={palier.id}
                        palier={palier}
                        onFini={rafraichir}
                        onAnnuler={() => setEnSuppression(null)}
                      />
                    ) : enEdition === palier.id && comptes.data ? (
                      <LigneEdition
                        key={palier.id}
                        palier={palier}
                        comptes={comptes.data}
                        onFini={rafraichir}
                        onAnnuler={() => setEnEdition(null)}
                      />
                    ) : (
                      <LigneLecture
                        key={palier.id}
                        palier={palier}
                        peutGerer={peutGerer}
                        onModifier={() => setEnEdition(palier.id)}
                        onRetirer={() => setEnSuppression(palier.id)}
                      />
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
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

function LigneLecture({
  palier,
  peutGerer,
  onModifier,
  onRetirer,
}: {
  palier: PalierSouffrance
  peutGerer: boolean
  onModifier: () => void
  onRetirer: () => void
}) {
  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-2">
        <span className="font-medium">{palier.libelle}</span>
        <span className="ml-2 font-mono text-xs text-muted-foreground">{palier.code}</span>
        {palier.is_terminal && (
          <span className="ml-2">
            <Badge ton="danger">{P.terminal}</Badge>
          </span>
        )}
        {palier.is_provisional && (
          <span className="ml-2" title={P.provisoireAide}>
            <Badge ton="warning">{P.provisoire}</Badge>
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{palier.seuil_jours}</td>
      <td className="px-3 py-2 text-right tabular-nums">{formatTaux(palier.taux_provision_bp)}</td>
      <td className="px-3 py-2">
        <TexteCompte compte={palier.compte_encours} />
      </td>
      <td className="px-3 py-2">
        <TexteCompte compte={palier.compte_dotation} />
      </td>
      {peutGerer && (
        <td className="px-3 py-2 text-right">
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={onModifier}>
              {P.modifier}
            </Button>
            <Button size="sm" variant="ghost" onClick={onRetirer}>
              {P.retirer}
            </Button>
          </div>
        </td>
      )}
    </tr>
  )
}

function SelectCompte({
  id,
  label,
  comptes,
  valeur,
  onChange,
}: {
  id: string
  label: string
  comptes: CompteSelecteur[]
  valeur: string | null
  onChange: (valeur: string | null) => void
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className="h-9 w-full rounded-md border bg-background px-2 text-xs"
        value={valeur ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">{P.aucun}</option>
        {comptes.map((c) => (
          <option key={c.id} value={c.account_number}>
            {c.account_number} — {c.name}
          </option>
        ))}
      </select>
    </div>
  )
}

function LigneEdition({
  palier,
  comptes,
  onFini,
  onAnnuler,
}: {
  palier?: PalierSouffrance
  comptes: CompteSelecteur[]
  onFini: () => void
  onAnnuler: () => void
}) {
  const [code, setCode] = useState(palier?.code ?? '')
  const [libelle, setLibelle] = useState(palier?.libelle ?? '')
  const [seuilJours, setSeuilJours] = useState(String(palier?.seuil_jours ?? ''))
  const [tauxBp, setTauxBp] = useState(String(palier?.taux_provision_bp ?? '0'))
  const [compteEncours, setCompteEncours] = useState(palier?.compte_encours?.account_number ?? null)
  const [compteDotation, setCompteDotation] = useState(
    palier?.compte_dotation?.account_number ?? null,
  )
  const [isTerminal, setIsTerminal] = useState(palier?.is_terminal ?? false)
  const [motif, setMotif] = useState('')

  const seuilNum = Number.parseInt(seuilJours.replace(/\D/g, ''), 10)
  const tauxNum = Number.parseInt(tauxBp.replace(/\D/g, ''), 10)
  const codeValide = code.trim().length > 0
  const libelleValide = libelle.trim().length > 0
  const seuilValide = seuilJours.trim() !== '' && !Number.isNaN(seuilNum) && seuilNum >= 0
  const tauxValide = tauxBp.trim() !== '' && !Number.isNaN(tauxNum) && tauxNum >= 0 && tauxNum <= 10000
  const motifValide = motif.trim().length >= 3
  const valide = codeValide && libelleValide && seuilValide && tauxValide && motifValide

  const corps = (): EcriturePalier => ({
    code: code.trim(),
    libelle: libelle.trim(),
    seuil_jours: seuilNum,
    taux_provision_bp: tauxNum,
    compte_encours: compteEncours,
    compte_dotation: compteDotation,
    is_terminal: isTerminal,
    motif: motif.trim(),
  })

  const mutation = useMutation({
    mutationFn: () => (palier ? modifierPalierSouffrance(palier.id, corps()) : creerPalierSouffrance(corps())),
    onSuccess: onFini,
  })

  const idBase = palier ? `pe-${palier.id}` : 'pe-nouveau'

  return (
    <tr className="border-b bg-brand-subtle/30 last:border-0">
      <td className="px-3 py-3 align-top" colSpan={5}>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor={`${idBase}-code`}>{P.code}</Label>
            <Input
              id={`${idBase}-code`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={P.codePlaceholder}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor={`${idBase}-libelle`}>{P.libelle}</Label>
            <Input
              id={`${idBase}-libelle`}
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              placeholder={P.libellePlaceholder}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idBase}-seuil`}>{P.seuilJours}</Label>
            <Input
              id={`${idBase}-seuil`}
              inputMode="numeric"
              value={seuilJours}
              onChange={(e) => setSeuilJours(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idBase}-taux`}>{P.tauxProvision}</Label>
            <Input
              id={`${idBase}-taux`}
              inputMode="numeric"
              value={tauxBp}
              onChange={(e) => setTauxBp(e.target.value)}
            />
            {tauxValide && (
              <p className="text-xs text-muted-foreground">{formatTaux(tauxNum)}</p>
            )}
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={isTerminal}
                onChange={(e) => setIsTerminal(e.target.checked)}
              />
              {P.estTerminal}
            </label>
          </div>
          <SelectCompte
            id={`${idBase}-encours`}
            label={P.colonneEncours}
            comptes={comptes}
            valeur={compteEncours}
            onChange={setCompteEncours}
          />
          <SelectCompte
            id={`${idBase}-dotation`}
            label={P.colonneDotation}
            comptes={comptes}
            valeur={compteDotation}
            onChange={setCompteDotation}
          />
          <div className="space-y-1 sm:col-span-3">
            <Label htmlFor={`${idBase}-motif`}>{P.motif}</Label>
            <Input
              id={`${idBase}-motif`}
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder={P.motifPlaceholder}
            />
          </div>
        </div>

        {mutation.isError && (
          <Alert variant="destructive" role="alert" className="mt-3">
            <AlertDescription>{messageRefusCompte(mutation.error, P.echec)}</AlertDescription>
          </Alert>
        )}

        <div className="mt-3 flex gap-2">
          <Button size="sm" disabled={!valide || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? P.enregistrementEnCours : P.enregistrer}
          </Button>
          <Button size="sm" variant="ghost" onClick={onAnnuler} disabled={mutation.isPending}>
            {P.annuler}
          </Button>
        </div>
      </td>
    </tr>
  )
}

function LigneSuppression({
  palier,
  onFini,
  onAnnuler,
}: {
  palier: PalierSouffrance
  onFini: () => void
  onAnnuler: () => void
}) {
  const [motif, setMotif] = useState('')
  const motifValide = motif.trim().length >= 3

  const mutation = useMutation({
    mutationFn: () => retirerPalierSouffrance(palier.id, motif.trim()),
    onSuccess: onFini,
  })

  return (
    <tr className="border-b bg-warning-subtle/30 last:border-0">
      <td className="px-3 py-3 align-top" colSpan={5}>
        <p className="text-sm">
          {P.confirmerRetrait} — <span className="font-medium">{palier.libelle}</span> (
          {palier.code})
        </p>
        <div className="mt-2 space-y-1">
          <Label htmlFor={`ps-${palier.id}-motif`}>{P.motif}</Label>
          <Input
            id={`ps-${palier.id}-motif`}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder={P.motifRetraitPlaceholder}
          />
        </div>

        {mutation.isError && (
          <Alert variant="destructive" role="alert" className="mt-2">
            <AlertDescription>{messageRefusCompte(mutation.error, P.echecRetrait)}</AlertDescription>
          </Alert>
        )}

        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            variant="destructive"
            disabled={!motifValide || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? P.retraitEnCours : P.confirmerRetrait}
          </Button>
          <Button size="sm" variant="ghost" onClick={onAnnuler} disabled={mutation.isPending}>
            {P.annuler}
          </Button>
        </div>
      </td>
    </tr>
  )
}
