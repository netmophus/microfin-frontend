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
  BASES_JOURS,
  listerParametresInteretProduits,
  messageRefusCompte,
  METHODES_CALCUL_SOLDE,
  modifierParametresInteretProduit,
  REGLES_ARRONDI,
  type BaseJours,
  type MethodeCalculSolde,
  type ParametresInteretProduit,
  type RegleArrondi,
} from '@/features/comptabilite/api'
import { LIBELLES } from '@/libelles/fr'

const P = LIBELLES.parametresInteretEpargne

const LIBELLE_METHODE: Record<MethodeCalculSolde, string> = {
  min_periode: P.methodeMinPeriode,
  moyen_quotidien: P.methodeMoyenQuotidien,
  fin_periode: P.methodeFinPeriode,
}

const LIBELLE_ARRONDI: Record<RegleArrondi, string> = {
  plus_proche: P.arrondiPlusProche,
  plancher: P.arrondiPlancher,
}

/** 350 points de base -> "3,5" (affiché) ; l'inverse à l'enregistrement. */
function bpVersPourcent(bp: number): string {
  return (bp / 100).toString().replace('.', ',')
}

function pourcentVersBp(saisie: string): number | null {
  const nombre = Number(saisie.replace(',', '.'))
  if (!Number.isFinite(nombre)) return null
  return Math.round(nombre * 100)
}

/**
 * Taux et règles de calcul du versement d'intérêts, par produit d'épargne (écran séparé des
 * rattachements comptables — même permission, sujet différent). `periodicite` n'est PAS réglée
 * ici : non exploitée par le moteur de versement, voir le commentaire dans comptabilite/api.ts.
 */
export function PageParametresInteretEpargne() {
  const client = useQueryClient()
  const [enEdition, setEnEdition] = useState<string | null>(null)
  const peutGerer = useAPermission('compta.plan.manage')

  const produits = useQuery({
    queryKey: ['comptabilite', 'parametres-interet-epargne'],
    queryFn: listerParametresInteretProduits,
  })

  const rafraichir = () => {
    setEnEdition(null)
    void client.invalidateQueries({ queryKey: ['comptabilite', 'parametres-interet-epargne'] })
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

      {produits.isPending ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{P.chargement}</p>
      ) : produits.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {produits.error instanceof AxiosError && produits.error.response?.status === 403
              ? P.interdit
              : P.erreur}
          </AlertDescription>
        </Alert>
      ) : produits.data.length === 0 ? (
        <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
          {P.listeVide}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{P.colonneProduit}</th>
                <th className="px-3 py-2 text-left font-medium">{P.colonneTaux}</th>
                <th className="px-3 py-2 text-left font-medium">{P.colonneMethode}</th>
                <th className="px-3 py-2 text-left font-medium">{P.colonneBaseJours}</th>
                <th className="px-3 py-2 text-left font-medium">{P.colonneArrondi}</th>
                <th className="px-3 py-2 text-left font-medium">{P.colonneSoldeMinimum}</th>
                {peutGerer && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {produits.data.map((produit) =>
                enEdition === produit.id ? (
                  <LigneEdition
                    key={produit.id}
                    produit={produit}
                    onFini={rafraichir}
                    onAnnuler={() => setEnEdition(null)}
                  />
                ) : (
                  <LigneLecture
                    key={produit.id}
                    produit={produit}
                    peutGerer={peutGerer}
                    onModifier={() => setEnEdition(produit.id)}
                  />
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function BadgeProvisoire() {
  return (
    <div title={P.provisoireAide} className="ml-2 inline-block align-middle">
      <Badge ton="warning">{P.provisoire}</Badge>
    </div>
  )
}

function LigneLecture({
  produit,
  peutGerer,
  onModifier,
}: {
  produit: ParametresInteretProduit
  peutGerer: boolean
  onModifier: () => void
}) {
  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-2">
        <span className="font-medium">{produit.name}</span>
        <span className="ml-2 font-mono text-xs text-muted-foreground">{produit.code}</span>
        {produit.is_provisional && <BadgeProvisoire />}
      </td>
      <td className="px-3 py-2 font-mono tabular-nums">{bpVersPourcent(produit.taux_bp)} %</td>
      <td className="px-3 py-2">{LIBELLE_METHODE[produit.methode_calcul_solde]}</td>
      <td className="px-3 py-2 font-mono tabular-nums">{produit.base_jours}</td>
      <td className="px-3 py-2">{LIBELLE_ARRONDI[produit.regle_arrondi]}</td>
      <td className="px-3 py-2 font-mono tabular-nums">
        {produit.solde_minimum_remunere.toLocaleString('fr-FR')}
      </td>
      {peutGerer && (
        <td className="px-3 py-2 text-right">
          <Button size="sm" variant="outline" onClick={onModifier}>
            {P.modifier}
          </Button>
        </td>
      )}
    </tr>
  )
}

function LigneEdition({
  produit,
  onFini,
  onAnnuler,
}: {
  produit: ParametresInteretProduit
  onFini: () => void
  onAnnuler: () => void
}) {
  const [taux, setTaux] = useState(bpVersPourcent(produit.taux_bp))
  const [methode, setMethode] = useState<MethodeCalculSolde>(produit.methode_calcul_solde)
  const [baseJours, setBaseJours] = useState<BaseJours>(produit.base_jours)
  const [arrondi, setArrondi] = useState<RegleArrondi>(produit.regle_arrondi)
  const [soldeMinimum, setSoldeMinimum] = useState(String(produit.solde_minimum_remunere))
  const [motif, setMotif] = useState('')

  const tauxBp = pourcentVersBp(taux)
  const soldeMinimumValeur = Number(soldeMinimum)
  const idBase = `pi-${produit.id}`

  const mutation = useMutation({
    mutationFn: () =>
      modifierParametresInteretProduit(produit.id, {
        taux_bp: tauxBp as number,
        methode_calcul_solde: methode,
        base_jours: baseJours,
        regle_arrondi: arrondi,
        solde_minimum_remunere: soldeMinimumValeur,
        motif: motif.trim(),
      }),
    onSuccess: onFini,
  })

  const formulaireValide =
    tauxBp !== null &&
    tauxBp >= 0 &&
    tauxBp <= 10000 &&
    Number.isInteger(soldeMinimumValeur) &&
    soldeMinimumValeur >= 0 &&
    motif.trim().length >= 3

  return (
    <tr className="border-b bg-brand-subtle/30 last:border-0">
      <td className="px-3 py-3 align-top" colSpan={6}>
        <div className="mb-3">
          <span className="font-medium">{produit.name}</span>
          <span className="ml-2 font-mono text-xs text-muted-foreground">{produit.code}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="space-y-1">
            <Label htmlFor={`${idBase}-taux`}>{P.taux}</Label>
            <Input
              id={`${idBase}-taux`}
              inputMode="decimal"
              value={taux}
              onChange={(e) => setTaux(e.target.value)}
              aria-describedby={`${idBase}-taux-aide`}
            />
            <p id={`${idBase}-taux-aide`} className="text-xs text-muted-foreground">
              {P.tauxAide}
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idBase}-methode`}>{P.methode}</Label>
            <select
              id={`${idBase}-methode`}
              className="h-9 w-full rounded-md border bg-background px-2 text-xs"
              value={methode}
              onChange={(e) => setMethode(e.target.value as MethodeCalculSolde)}
            >
              {METHODES_CALCUL_SOLDE.map((m) => (
                <option key={m} value={m}>
                  {LIBELLE_METHODE[m]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idBase}-base-jours`}>{P.baseJours}</Label>
            <select
              id={`${idBase}-base-jours`}
              className="h-9 w-full rounded-md border bg-background px-2 text-xs"
              value={baseJours}
              onChange={(e) => setBaseJours(Number(e.target.value) as BaseJours)}
            >
              {BASES_JOURS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idBase}-arrondi`}>{P.arrondi}</Label>
            <select
              id={`${idBase}-arrondi`}
              className="h-9 w-full rounded-md border bg-background px-2 text-xs"
              value={arrondi}
              onChange={(e) => setArrondi(e.target.value as RegleArrondi)}
            >
              {REGLES_ARRONDI.map((a) => (
                <option key={a} value={a}>
                  {LIBELLE_ARRONDI[a]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idBase}-solde-min`}>{P.soldeMinimum}</Label>
            <Input
              id={`${idBase}-solde-min`}
              inputMode="numeric"
              value={soldeMinimum}
              onChange={(e) => setSoldeMinimum(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-3 max-w-md space-y-2">
          <div className="space-y-1">
            <Label htmlFor={`${idBase}-motif`}>{P.motif}</Label>
            <Input
              id={`${idBase}-motif`}
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
            <Button
              size="sm"
              disabled={!formulaireValide || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? P.enregistrementEnCours : P.enregistrer}
            </Button>
            <Button size="sm" variant="ghost" onClick={onAnnuler}>
              {P.annuler}
            </Button>
          </div>
        </div>
      </td>
    </tr>
  )
}
