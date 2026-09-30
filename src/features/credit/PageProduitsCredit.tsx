import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { useState } from 'react'

import { SelecteurCompte } from '@/components/comptabilite/selecteur-compte'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAPermission } from '@/features/auth/useProfil'
import { REGLES_ARRONDI, type RegleArrondi } from '@/features/comptabilite/api'
import {
  changerActivationProduitCredit,
  creerProduitCredit,
  lireRattachementsProduitCredit,
  listerProduitsCreditGestion,
  messageRefusCredit,
  METHODES_AMORTISSEMENT,
  modifierProduitCredit,
  modifierRattachementsProduitCredit,
  PERIODICITES_CREDIT,
  validerProduitCredit,
  type MethodeAmortissement,
  type PeriodiciteCredit,
  type ProduitCreditDetail,
} from '@/features/credit/api'
import { formatTaux } from '@/features/epargne/api'
import { LIBELLES } from '@/libelles/fr'

const P = LIBELLES.produitsCredit

const LIBELLE_METHODE: Record<MethodeAmortissement, string> = {
  capital_constant: P.methodeCapitalConstant,
  echeance_constante: P.methodeEcheanceConstante,
}

const LIBELLE_PERIODICITE: Record<PeriodiciteCredit, string> = {
  mensuelle: P.periodiciteMensuelle,
  trimestrielle: P.periodiciteTrimestrielle,
  annuelle: P.periodiciteAnnuelle,
}

const LIBELLE_ARRONDI: Record<RegleArrondi, string> = {
  plus_proche: P.arrondiPlusProche,
  plancher: P.arrondiPlancher,
}

/** 1200 points de base -> "12" (affiché) ; l'inverse à l'enregistrement. */
function bpVersPourcent(bp: number): string {
  return (bp / 100).toString().replace('.', ',')
}

function pourcentVersBp(saisie: string): number | null {
  const nombre = Number(saisie.replace(',', '.'))
  if (!Number.isFinite(nombre)) return null
  return Math.round(nombre * 100)
}

type Onglet = 'produit' | 'rattachements'

/**
 * Référentiel des produits de crédit (chantier « gestion des produits », lot 3c) — UN SEUL
 * écran à onglets (contrairement à l'épargne, qui garde 2 écrans séparés) : Produit
 * (credit.product.manage, ADMIN_FONCTIONNEL — cycle de vie et paramètres) et Rattachements
 * comptables (compta.plan.manage, comptable — les 3 comptes). L'onglet Rattachements ne
 * s'affiche que pour qui détient AU MOINS la lecture (compta.plan.read) — la route elle-même
 * exige credit.product.read, qui ne garantit pas ce second accès.
 */
export function PageProduitsCredit() {
  const peutVoirRattachements = useAPermission('compta.plan.read')
  const [onglet, setOnglet] = useState<Onglet>('produit')
  const [produitPourRattachement, setProduitPourRattachement] = useState<string | null>(null)

  const allerAuxRattachements = (produitId: string) => {
    setProduitPourRattachement(produitId)
    setOnglet('rattachements')
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{P.titre}</h1>
        <p className="text-sm text-muted-foreground">{P.sousTitre}</p>
      </div>

      <div className="flex border-b" role="tablist">
        <BoutonOnglet actif={onglet === 'produit'} onClick={() => setOnglet('produit')}>
          {P.ongletProduit}
        </BoutonOnglet>
        {peutVoirRattachements && (
          <BoutonOnglet
            actif={onglet === 'rattachements'}
            onClick={() => setOnglet('rattachements')}
          >
            {P.ongletRattachements}
          </BoutonOnglet>
        )}
      </div>

      {onglet === 'produit' && <OngletProduit onRattacher={allerAuxRattachements} />}
      {onglet === 'rattachements' && peutVoirRattachements && (
        <OngletRattachements produitInitial={produitPourRattachement} />
      )}
    </div>
  )
}

function BoutonOnglet({
  actif,
  onClick,
  children,
}: {
  actif: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={actif}
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
        actif
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}

// --- Onglet Produit (credit.product.manage) ------------------------------------------------

function OngletProduit({ onRattacher }: { onRattacher: (produitId: string) => void }) {
  const client = useQueryClient()
  const peutGerer = useAPermission('credit.product.manage')
  const [creation, setCreation] = useState(false)
  const [ligneActive, setLigneActive] = useState<{ id: string; type: 'edition' | 'activation' } | null>(
    null,
  )
  const [avertissements, setAvertissements] = useState<string[] | null>(null)

  const produits = useQuery({
    queryKey: ['credit', 'produits-gestion'],
    queryFn: listerProduitsCreditGestion,
  })

  const rafraichir = () => {
    setCreation(false)
    setLigneActive(null)
    void client.invalidateQueries({ queryKey: ['credit', 'produits-gestion'] })
  }

  return (
    <div className="space-y-4">
      {peutGerer && !creation && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setCreation(true)}>
            {P.ajouter}
          </Button>
        </div>
      )}

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

      {creation && <FormulaireCreation onFini={rafraichir} onAnnuler={() => setCreation(false)} />}

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
                <th className="px-3 py-2 text-right font-medium">{P.colonneTaux}</th>
                <th className="px-3 py-2 text-left font-medium">{P.colonneMethode}</th>
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
                    onRattacher={() => onRattacher(produit.id)}
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
  onRattacher,
  onValide,
}: {
  produit: ProduitCreditDetail
  peutGerer: boolean
  onModifier: () => void
  onActiver: () => void
  onRattacher: () => void
  onValide: (avertissements: string[]) => void
}) {
  const validation = useMutation({
    mutationFn: () => validerProduitCredit(produit.id),
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
            <button
              type="button"
              onClick={onRattacher}
              className="underline underline-offset-2 hover:text-foreground"
            >
              {P.lienRattachement}
            </button>
          </p>
        )}
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums">{formatTaux(produit.taux_bp)}</td>
      <td className="px-3 py-2">{LIBELLE_METHODE[produit.methode_amortissement]}</td>
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
                {messageRefusCredit(validation.error, P.echecValidation)}
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
  produit: ProduitCreditDetail
  onFini: () => void
  onAnnuler: () => void
}) {
  const [name, setName] = useState(produit.name)
  const [taux, setTaux] = useState(bpVersPourcent(produit.taux_bp))
  const [periodicite, setPeriodicite] = useState<PeriodiciteCredit>(produit.periodicite)
  const [methode, setMethode] = useState<MethodeAmortissement>(produit.methode_amortissement)
  const [arrondi, setArrondi] = useState<RegleArrondi>(produit.regle_arrondi)
  const [tauxUsure, setTauxUsure] = useState(
    produit.taux_usure_max_bp === null ? '' : bpVersPourcent(produit.taux_usure_max_bp),
  )
  const [motif, setMotif] = useState('')

  const tauxBp = pourcentVersBp(taux)
  const tauxUsureBp = tauxUsure.trim() === '' ? null : pourcentVersBp(tauxUsure)
  const idBase = `pc-${produit.id}`

  const mutation = useMutation({
    mutationFn: () =>
      modifierProduitCredit(produit.id, {
        name: name.trim(),
        taux_bp: tauxBp as number,
        periodicite,
        methode_amortissement: methode,
        regle_arrondi: arrondi,
        taux_usure_max_bp: tauxUsureBp,
        motif: motif.trim(),
      }),
    onSuccess: onFini,
  })

  const formulaireValide =
    name.trim().length > 0 &&
    tauxBp !== null &&
    tauxBp >= 0 &&
    tauxBp <= 10000 &&
    (tauxUsure.trim() === '' || (tauxUsureBp !== null && tauxUsureBp >= 0)) &&
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
              onChange={(e) => setPeriodicite(e.target.value as PeriodiciteCredit)}
            >
              {PERIODICITES_CREDIT.map((p) => (
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
              onChange={(e) => setMethode(e.target.value as MethodeAmortissement)}
            >
              {METHODES_AMORTISSEMENT.map((m) => (
                <option key={m} value={m}>
                  {LIBELLE_METHODE[m]}
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
            <Label htmlFor={`${idBase}-usure`}>{P.tauxUsureMax}</Label>
            <Input
              id={`${idBase}-usure`}
              inputMode="decimal"
              value={tauxUsure}
              onChange={(e) => setTauxUsure(e.target.value)}
              placeholder="—"
              aria-describedby={`${idBase}-usure-aide`}
            />
            <p id={`${idBase}-usure-aide`} className="text-xs text-muted-foreground">
              {P.tauxUsureMaxAide}
            </p>
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
              <AlertDescription>{messageRefusCredit(mutation.error, P.echecModification)}</AlertDescription>
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
  produit: ProduitCreditDetail
  onFini: () => void
  onAnnuler: () => void
}) {
  const [motif, setMotif] = useState('')
  const motifValide = motif.trim().length >= 3
  const cible = !produit.is_active

  const mutation = useMutation({
    mutationFn: () => changerActivationProduitCredit(produit.id, cible, motif.trim()),
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
          <Label htmlFor={`pca-${produit.id}-motif`}>{P.motif}</Label>
          <Input
            id={`pca-${produit.id}-motif`}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder={P.motifPlaceholder}
          />
        </div>

        {mutation.isError && (
          <Alert variant="destructive" role="alert" className="mt-2 max-w-md">
            <AlertDescription>{messageRefusCredit(mutation.error, P.echecActivation)}</AlertDescription>
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
  const [taux, setTaux] = useState('0')
  const [periodicite, setPeriodicite] = useState<PeriodiciteCredit>('mensuelle')
  const [methode, setMethode] = useState<MethodeAmortissement>('echeance_constante')
  const [arrondi, setArrondi] = useState<RegleArrondi>('plus_proche')
  const [tauxUsure, setTauxUsure] = useState('')

  const tauxBp = pourcentVersBp(taux)
  const tauxUsureBp = tauxUsure.trim() === '' ? null : pourcentVersBp(tauxUsure)
  const idBase = 'pc-creation'

  const mutation = useMutation({
    mutationFn: () =>
      creerProduitCredit({
        code: code.trim(),
        name: name.trim(),
        taux_bp: tauxBp as number,
        periodicite,
        methode_amortissement: methode,
        regle_arrondi: arrondi,
        taux_usure_max_bp: tauxUsureBp,
      }),
    onSuccess: onFini,
  })

  const formulaireValide =
    code.trim().length > 0 &&
    name.trim().length > 0 &&
    tauxBp !== null &&
    tauxBp >= 0 &&
    tauxBp <= 10000 &&
    (tauxUsure.trim() === '' || (tauxUsureBp !== null && tauxUsureBp >= 0))

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
            onChange={(e) => setPeriodicite(e.target.value as PeriodiciteCredit)}
          >
            {PERIODICITES_CREDIT.map((p) => (
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
            onChange={(e) => setMethode(e.target.value as MethodeAmortissement)}
          >
            {METHODES_AMORTISSEMENT.map((m) => (
              <option key={m} value={m}>
                {LIBELLE_METHODE[m]}
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
          <Label htmlFor={`${idBase}-usure`}>{P.tauxUsureMax}</Label>
          <Input
            id={`${idBase}-usure`}
            inputMode="decimal"
            value={tauxUsure}
            onChange={(e) => setTauxUsure(e.target.value)}
            placeholder="—"
            aria-describedby={`${idBase}-usure-aide`}
          />
          <p id={`${idBase}-usure-aide`} className="text-xs text-muted-foreground">
            {P.tauxUsureMaxAide}
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{P.baseCalculInfo}</p>

      {mutation.isError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{messageRefusCredit(mutation.error, P.echecCreation)}</AlertDescription>
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

// --- Onglet Rattachements comptables (compta.plan.manage) ----------------------------------

function OngletRattachements({ produitInitial }: { produitInitial: string | null }) {
  const peutGerer = useAPermission('compta.plan.manage')
  const [produitId, setProduitId] = useState<string | null>(produitInitial)

  const produits = useQuery({
    queryKey: ['credit', 'produits-gestion'],
    queryFn: listerProduitsCreditGestion,
  })

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription>{P.rattachementsAvertissement}</AlertDescription>
      </Alert>

      {produits.isPending ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{P.chargement}</p>
      ) : produits.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{P.erreur}</AlertDescription>
        </Alert>
      ) : produits.data.length === 0 ? (
        <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
          {P.listeVide}
        </p>
      ) : (
        <div className="max-w-sm space-y-1">
          <Label htmlFor="rc-produit">{P.choisirProduit}</Label>
          <select
            id="rc-produit"
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            value={produitId ?? ''}
            onChange={(e) => setProduitId(e.target.value || null)}
          >
            <option value="">{P.choisirProduit}</option>
            {produits.data.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {produitId && <RattachementsContenu produitId={produitId} peutGerer={peutGerer} />}
    </div>
  )
}

function RattachementsContenu({
  produitId,
  peutGerer,
}: {
  produitId: string
  peutGerer: boolean
}) {
  const client = useQueryClient()
  const [enEdition, setEnEdition] = useState(false)

  const rattachements = useQuery({
    queryKey: ['credit', 'rattachements', produitId],
    queryFn: () => lireRattachementsProduitCredit(produitId),
  })

  const rafraichir = () => {
    setEnEdition(false)
    void client.invalidateQueries({ queryKey: ['credit', 'rattachements', produitId] })
  }

  if (rattachements.isPending) {
    return <p className="text-sm text-muted-foreground">{P.chargementRattachements}</p>
  }
  if (rattachements.isError) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription>
          {rattachements.error instanceof AxiosError && rattachements.error.response?.status === 403
            ? P.interditRattachements
            : P.erreurRattachements}
        </AlertDescription>
      </Alert>
    )
  }

  if (enEdition) {
    return (
      <FormulaireRattachements
        produitId={produitId}
        actuel={rattachements.data}
        onFini={rafraichir}
        onAnnuler={() => setEnEdition(false)}
      />
    )
  }

  const r = rattachements.data
  return (
    <div className="rounded-md border p-4">
      <dl className="grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">{P.colonneCompteMembre}</dt>
          <dd className="mt-0.5">
            <TexteCompte compte={r.compte_credit_membre} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{P.colonneCompteClient}</dt>
          <dd className="mt-0.5">
            <TexteCompte compte={r.compte_credit_client} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{P.colonneCompteInterets}</dt>
          <dd className="mt-0.5">
            <TexteCompte compte={r.compte_produits_interets} />
          </dd>
        </div>
      </dl>
      {peutGerer && (
        <div className="mt-3">
          <Button size="sm" variant="outline" onClick={() => setEnEdition(true)}>
            {P.modifier}
          </Button>
        </div>
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

function libelleCompte(compte: { account_number: string; name: string } | null): string | null {
  return compte ? `${compte.account_number} — ${compte.name}` : null
}

function FormulaireRattachements({
  produitId,
  actuel,
  onFini,
  onAnnuler,
}: {
  produitId: string
  actuel: {
    compte_credit_membre: { account_number: string; name: string } | null
    compte_credit_client: { account_number: string; name: string } | null
    compte_produits_interets: { account_number: string; name: string } | null
  }
  onFini: () => void
  onAnnuler: () => void
}) {
  const [compteMembre, setCompteMembre] = useState(
    actuel.compte_credit_membre?.account_number ?? null,
  )
  const [compteClient, setCompteClient] = useState(
    actuel.compte_credit_client?.account_number ?? null,
  )
  const [compteInterets, setCompteInterets] = useState(
    actuel.compte_produits_interets?.account_number ?? null,
  )
  const [motif, setMotif] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      modifierRattachementsProduitCredit(produitId, {
        compte_credit_membre: compteMembre,
        compte_credit_client: compteClient,
        compte_produits_interets: compteInterets,
        motif: motif.trim(),
      }),
    onSuccess: onFini,
  })

  const motifValide = motif.trim().length >= 3

  return (
    <div className="rounded-md border p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SelecteurCompte
          id="rc-membre"
          label={P.colonneCompteMembre}
          filtre="saisie"
          valeur={compteMembre}
          onChange={setCompteMembre}
          libelleInitial={libelleCompte(actuel.compte_credit_membre)}
        />
        <SelecteurCompte
          id="rc-client"
          label={P.colonneCompteClient}
          filtre="saisie"
          valeur={compteClient}
          onChange={setCompteClient}
          libelleInitial={libelleCompte(actuel.compte_credit_client)}
        />
        <SelecteurCompte
          id="rc-interets"
          label={P.colonneCompteInterets}
          filtre="saisie"
          valeur={compteInterets}
          onChange={setCompteInterets}
          libelleInitial={libelleCompte(actuel.compte_produits_interets)}
        />
      </div>

      <div className="mt-3 max-w-md space-y-2">
        <div className="space-y-1">
          <Label htmlFor="rc-motif">{P.motif}</Label>
          <Input
            id="rc-motif"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder={P.motifPlaceholder}
          />
        </div>
        {mutation.isError && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>
              {messageRefusCredit(mutation.error, P.echecRattachements)}
            </AlertDescription>
          </Alert>
        )}
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={!motifValide || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? P.enregistrementEnCours : P.enregistrer}
          </Button>
          <Button size="sm" variant="ghost" onClick={onAnnuler} disabled={mutation.isPending}>
            {P.annuler}
          </Button>
        </div>
      </div>
    </div>
  )
}
