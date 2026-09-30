import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAPermission } from '@/features/auth/useProfil'
import {
  BASES_JOURS,
  METHODES_CALCUL_SOLDE,
  REGLES_ARRONDI,
  type BaseJours,
  type MethodeCalculSolde,
  type RegleArrondi,
} from '@/features/comptabilite/api'
import {
  changerActivationProduit,
  creerProduit,
  formatTaux,
  listerProduitsGestion,
  messageRefus,
  modifierProduit,
  PERIODICITES,
  TYPES_PRODUIT,
  validerProduit,
  type Periodicite,
  type ProduitEpargneDetail,
  type TypeProduit,
} from '@/features/epargne/api'
import { LIBELLES } from '@/libelles/fr'

const P = LIBELLES.produitsEpargne

const LIBELLE_TYPE: Record<TypeProduit, string> = {
  a_vue: P.typeAVue,
  terme: P.typeTerme,
  programmee: P.typeProgrammee,
}

const LIBELLE_PERIODICITE: Record<Periodicite, string> = {
  mensuelle: P.periodiciteMensuelle,
  trimestrielle: P.periodiciteTrimestrielle,
  annuelle: P.periodiciteAnnuelle,
}

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

type EtatLigne = { id: string; type: 'edition' | 'activation' } | null

/**
 * Référentiel des produits d'épargne (chantier « gestion des produits », lot 2/3) —
 * epargne.product.manage (ADMIN_FONCTIONNEL) : créer, régler les paramètres métier, valider
 * (lever le provisoire) et activer/désactiver le catalogue. Distinct des écrans comptables
 * (Rattachements épargne, Taux d'intérêt épargne) : ceux-là restent sur compta.plan.manage,
 * réservés au comptable, et ne sont jamais dupliqués ici — une ligne provisoire y renvoie.
 */
export function PageProduitsEpargne() {
  const client = useQueryClient()
  const peutGerer = useAPermission('epargne.product.manage')
  const [creation, setCreation] = useState(false)
  const [ligneActive, setLigneActive] = useState<EtatLigne>(null)
  const [avertissements, setAvertissements] = useState<string[] | null>(null)

  const produits = useQuery({
    queryKey: ['epargne', 'produits-gestion'],
    queryFn: listerProduitsGestion,
  })

  const rafraichir = () => {
    setCreation(false)
    setLigneActive(null)
    void client.invalidateQueries({ queryKey: ['epargne', 'produits-gestion'] })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{P.titre}</h1>
          <p className="text-sm text-muted-foreground">{P.sousTitre}</p>
        </div>
        {peutGerer && !creation && (
          <Button size="sm" onClick={() => setCreation(true)}>
            {P.ajouter}
          </Button>
        )}
      </div>

      {avertissements && avertissements.length > 0 && (
        <Alert>
          <AlertDescription>
            <p className="font-medium">{P.validationAvertissementTitre}</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {avertissements.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {creation && (
        <FormulaireCreation onFini={rafraichir} onAnnuler={() => setCreation(false)} />
      )}

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
                <th className="px-3 py-2 text-left font-medium">{P.colonneCode}</th>
                <th className="px-3 py-2 text-left font-medium">{P.colonneNom}</th>
                <th className="px-3 py-2 text-left font-medium">{P.colonneType}</th>
                <th className="px-3 py-2 text-right font-medium">{P.colonneTaux}</th>
                <th className="px-3 py-2 text-left font-medium">{P.colonneStatut}</th>
                {peutGerer && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {produits.data.map((produit) => {
                if (ligneActive?.id === produit.id && ligneActive.type === 'edition') {
                  return (
                    <LigneEdition
                      key={produit.id}
                      produit={produit}
                      onFini={rafraichir}
                      onAnnuler={() => setLigneActive(null)}
                    />
                  )
                }
                if (ligneActive?.id === produit.id && ligneActive.type === 'activation') {
                  return (
                    <LigneActivation
                      key={produit.id}
                      produit={produit}
                      onFini={rafraichir}
                      onAnnuler={() => setLigneActive(null)}
                    />
                  )
                }
                return (
                  <LigneLecture
                    key={produit.id}
                    produit={produit}
                    peutGerer={peutGerer}
                    onModifier={() => setLigneActive({ id: produit.id, type: 'edition' })}
                    onActiver={() => setLigneActive({ id: produit.id, type: 'activation' })}
                    onValide={(messages) => {
                      setAvertissements(messages)
                      rafraichir()
                    }}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function LigneLecture({
  produit,
  peutGerer,
  onModifier,
  onActiver,
  onValide,
}: {
  produit: ProduitEpargneDetail
  peutGerer: boolean
  onModifier: () => void
  onActiver: () => void
  onValide: (avertissements: string[]) => void
}) {
  const validation = useMutation({
    mutationFn: () => validerProduit(produit.id),
    onSuccess: (resultat) => onValide(resultat.avertissements),
  })

  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-2 font-mono text-xs">{produit.code}</td>
      <td className="px-3 py-2">
        <span className="font-medium">{produit.name}</span>
        {produit.is_provisional && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {P.enAttenteRattachement} —{' '}
            <Link
              to="/comptabilite/rattachements-epargne"
              className="underline underline-offset-2 hover:text-foreground"
            >
              {P.lienRattachement}
            </Link>
          </p>
        )}
      </td>
      <td className="px-3 py-2">{LIBELLE_TYPE[produit.type]}</td>
      <td className="px-3 py-2 text-right font-mono tabular-nums">{formatTaux(produit.taux_bp)}</td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1.5">
          {produit.is_provisional && <Badge ton="warning">{P.statutProvisoire}</Badge>}
          <Badge ton={produit.is_active ? 'success' : 'neutral'}>
            {produit.is_active ? P.statutActif : P.statutInactif}
          </Badge>
        </div>
      </td>
      {peutGerer && (
        <td className="px-3 py-2 text-right">
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="outline" onClick={onModifier}>
              {P.modifier}
            </Button>
            {produit.is_provisional && (
              <Button
                size="sm"
                variant="outline"
                disabled={validation.isPending}
                onClick={() => validation.mutate()}
              >
                {validation.isPending ? P.validationEnCours : P.valider}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={onActiver}>
              {produit.is_active ? P.desactiver : P.activer}
            </Button>
          </div>
          {validation.isError && (
            <Alert variant="destructive" role="alert" className="mt-2 text-left">
              <AlertDescription>
                {messageRefus(validation.error, P.echecValidation)}
              </AlertDescription>
            </Alert>
          )}
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
  produit: ProduitEpargneDetail
  onFini: () => void
  onAnnuler: () => void
}) {
  const [name, setName] = useState(produit.name)
  const [type, setType] = useState<TypeProduit>(produit.type)
  const [taux, setTaux] = useState(bpVersPourcent(produit.taux_bp))
  const [periodicite, setPeriodicite] = useState<Periodicite>(produit.periodicite)
  const [methode, setMethode] = useState<MethodeCalculSolde>(produit.methode_calcul_solde)
  const [baseJours, setBaseJours] = useState<BaseJours>(produit.base_jours)
  const [arrondi, setArrondi] = useState<RegleArrondi>(produit.regle_arrondi)
  const [soldeMinimum, setSoldeMinimum] = useState(String(produit.solde_minimum_remunere))
  const [motif, setMotif] = useState('')

  const tauxBp = pourcentVersBp(taux)
  const soldeMinimumValeur = Number(soldeMinimum)
  const idBase = `pe-${produit.id}`

  const mutation = useMutation({
    mutationFn: () =>
      modifierProduit(produit.id, {
        name: name.trim(),
        type,
        taux_bp: tauxBp as number,
        periodicite,
        methode_calcul_solde: methode,
        base_jours: baseJours,
        regle_arrondi: arrondi,
        solde_minimum_remunere: soldeMinimumValeur,
        motif: motif.trim(),
      }),
    onSuccess: onFini,
  })

  const formulaireValide =
    name.trim().length > 0 &&
    tauxBp !== null &&
    tauxBp >= 0 &&
    tauxBp <= 10000 &&
    Number.isInteger(soldeMinimumValeur) &&
    soldeMinimumValeur >= 0 &&
    motif.trim().length >= 3

  return (
    <tr className="border-b bg-brand-subtle/30 last:border-0">
      <td className="px-3 py-3 align-top" colSpan={6}>
        <div className="mb-3 font-mono text-xs text-muted-foreground">{produit.code}</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor={`${idBase}-nom`}>{P.nom}</Label>
            <Input id={`${idBase}-nom`} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idBase}-type`}>{P.type}</Label>
            <select
              id={`${idBase}-type`}
              className="h-9 w-full rounded-md border bg-background px-2 text-xs"
              value={type}
              onChange={(e) => setType(e.target.value as TypeProduit)}
            >
              {TYPES_PRODUIT.map((t) => (
                <option key={t} value={t}>
                  {LIBELLE_TYPE[t]}
                </option>
              ))}
            </select>
          </div>
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
            <Label htmlFor={`${idBase}-periodicite`}>{P.periodicite}</Label>
            <select
              id={`${idBase}-periodicite`}
              className="h-9 w-full rounded-md border bg-background px-2 text-xs"
              value={periodicite}
              onChange={(e) => setPeriodicite(e.target.value as Periodicite)}
            >
              {PERIODICITES.map((p) => (
                <option key={p} value={p}>
                  {LIBELLE_PERIODICITE[p]}
                </option>
              ))}
            </select>
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
              <AlertDescription>{messageRefus(mutation.error, P.echecModification)}</AlertDescription>
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
            <Button size="sm" variant="ghost" onClick={onAnnuler} disabled={mutation.isPending}>
              {P.annuler}
            </Button>
          </div>
        </div>
      </td>
    </tr>
  )
}

function LigneActivation({
  produit,
  onFini,
  onAnnuler,
}: {
  produit: ProduitEpargneDetail
  onFini: () => void
  onAnnuler: () => void
}) {
  const [motif, setMotif] = useState('')
  const motifValide = motif.trim().length >= 3
  const cible = !produit.is_active // ce qu'on demande, l'inverse de l'état actuel

  const mutation = useMutation({
    mutationFn: () => changerActivationProduit(produit.id, cible, motif.trim()),
    onSuccess: onFini,
  })

  return (
    <tr className="border-b bg-warning-subtle/30 last:border-0">
      <td className="px-3 py-3 align-top" colSpan={6}>
        <p className="text-sm">
          {cible ? P.confirmerActivation : P.confirmerDesactivation} —{' '}
          <span className="font-medium">{produit.name}</span>{' '}
          <span className="font-mono text-xs text-muted-foreground">{produit.code}</span>
        </p>
        <div className="mt-2 max-w-md space-y-1">
          <Label htmlFor={`pa-${produit.id}-motif`}>{P.motif}</Label>
          <Input
            id={`pa-${produit.id}-motif`}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder={P.motifPlaceholder}
          />
        </div>

        {mutation.isError && (
          <Alert variant="destructive" role="alert" className="mt-2 max-w-md">
            <AlertDescription>{messageRefus(mutation.error, P.echecActivation)}</AlertDescription>
          </Alert>
        )}

        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            variant={cible ? 'default' : 'destructive'}
            disabled={!motifValide || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? P.enregistrementEnCours : cible ? P.activer : P.desactiver}
          </Button>
          <Button size="sm" variant="ghost" onClick={onAnnuler} disabled={mutation.isPending}>
            {P.annuler}
          </Button>
        </div>
      </td>
    </tr>
  )
}

function FormulaireCreation({ onFini, onAnnuler }: { onFini: () => void; onAnnuler: () => void }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<TypeProduit>('a_vue')
  const [taux, setTaux] = useState('0')
  const [periodicite, setPeriodicite] = useState<Periodicite>('annuelle')
  const [methode, setMethode] = useState<MethodeCalculSolde>('fin_periode')
  const [baseJours, setBaseJours] = useState<BaseJours>(360)
  const [arrondi, setArrondi] = useState<RegleArrondi>('plus_proche')
  const [soldeMinimum, setSoldeMinimum] = useState('0')

  const tauxBp = pourcentVersBp(taux)
  const soldeMinimumValeur = Number(soldeMinimum)
  const idBase = 'pe-creation'

  const mutation = useMutation({
    mutationFn: () =>
      creerProduit({
        code: code.trim(),
        name: name.trim(),
        type,
        currency: 'XOF',
        taux_bp: tauxBp as number,
        periodicite,
        methode_calcul_solde: methode,
        base_jours: baseJours,
        regle_arrondi: arrondi,
        solde_minimum_remunere: soldeMinimumValeur,
      }),
    onSuccess: onFini,
  })

  const formulaireValide =
    code.trim().length > 0 &&
    name.trim().length > 0 &&
    tauxBp !== null &&
    tauxBp >= 0 &&
    tauxBp <= 10000 &&
    Number.isInteger(soldeMinimumValeur) &&
    soldeMinimumValeur >= 0

  return (
    <div className="space-y-3 rounded-md border p-4">
      <Alert>
        <AlertDescription>{P.creationAvertissement}</AlertDescription>
      </Alert>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor={`${idBase}-code`}>{P.code}</Label>
          <Input
            id={`${idBase}-code`}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={P.codePlaceholder}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idBase}-nom`}>{P.nom}</Label>
          <Input id={`${idBase}-nom`} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idBase}-type`}>{P.type}</Label>
          <select
            id={`${idBase}-type`}
            className="h-9 w-full rounded-md border bg-background px-2 text-xs"
            value={type}
            onChange={(e) => setType(e.target.value as TypeProduit)}
          >
            {TYPES_PRODUIT.map((t) => (
              <option key={t} value={t}>
                {LIBELLE_TYPE[t]}
              </option>
            ))}
          </select>
        </div>
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
          <Label htmlFor={`${idBase}-periodicite`}>{P.periodicite}</Label>
          <select
            id={`${idBase}-periodicite`}
            className="h-9 w-full rounded-md border bg-background px-2 text-xs"
            value={periodicite}
            onChange={(e) => setPeriodicite(e.target.value as Periodicite)}
          >
            {PERIODICITES.map((p) => (
              <option key={p} value={p}>
                {LIBELLE_PERIODICITE[p]}
              </option>
            ))}
          </select>
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

      <p className="text-xs text-muted-foreground">{P.decouvertNonAutorise}</p>

      {mutation.isError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{messageRefus(mutation.error, P.echecCreation)}</AlertDescription>
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
        <Button size="sm" variant="ghost" onClick={onAnnuler} disabled={mutation.isPending}>
          {P.annuler}
        </Button>
      </div>
    </div>
  )
}
