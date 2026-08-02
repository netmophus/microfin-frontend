import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAPermission } from '@/features/auth/useProfil'
import {
  listerComptesSelecteur,
  listerRattachementsProduits,
  messageRefusCompte,
  modifierRattachementsProduit,
  type CompteSelecteur,
  type RattachementsProduit,
} from '@/features/comptabilite/api'
import { LIBELLES } from '@/libelles/fr'

const P = LIBELLES.rattachementsEpargne

/**
 * Rattachements comptables des produits d'épargne (Bloc 5). Un produit à la fois passe en
 * édition (3 sélecteurs + motif) ; le reste de la liste reste en lecture. Les sélecteurs ne
 * proposent que des comptes de saisie actifs (filtré côté serveur) ; le serveur revérifie
 * aussi à l'enregistrement — ce sélecteur est un confort, pas la seule protection.
 */
export function PageRattachementsEpargne() {
  const client = useQueryClient()
  const [enEdition, setEnEdition] = useState<string | null>(null)
  const peutGerer = useAPermission('compta.plan.manage')

  const produits = useQuery({
    queryKey: ['comptabilite', 'rattachements-epargne'],
    queryFn: listerRattachementsProduits,
  })
  const comptes = useQuery({
    queryKey: ['comptabilite', 'comptes-selecteur'],
    queryFn: () => listerComptesSelecteur(),
    enabled: peutGerer,
  })

  const rafraichir = () => {
    setEnEdition(null)
    void client.invalidateQueries({ queryKey: ['comptabilite', 'rattachements-epargne'] })
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
                <th className="px-3 py-2 text-left font-medium">{P.colonneEpargne}</th>
                <th className="px-3 py-2 text-left font-medium">{P.colonneEpargneClient}</th>
                <th className="px-3 py-2 text-left font-medium">{P.colonneInteret}</th>
                {peutGerer && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {produits.data.map((produit) =>
                enEdition === produit.id && comptes.data ? (
                  <LigneEdition
                    key={produit.id}
                    produit={produit}
                    comptes={comptes.data}
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

function TexteCompte({ compte }: { compte: { account_number: string; name: string } | null }) {
  if (!compte) return <span className="text-muted-foreground">{P.aucun}</span>
  return (
    <span className="font-mono text-xs">
      {compte.account_number} — {compte.name}
    </span>
  )
}

function LigneLecture({
  produit,
  peutGerer,
  onModifier,
}: {
  produit: RattachementsProduit
  peutGerer: boolean
  onModifier: () => void
}) {
  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-2">
        <span className="font-medium">{produit.name}</span>
        <span className="ml-2 font-mono text-xs text-muted-foreground">{produit.code}</span>
      </td>
      <td className="px-3 py-2">
        <TexteCompte compte={produit.compte_epargne} />
      </td>
      <td className="px-3 py-2">
        <TexteCompte compte={produit.compte_epargne_client} />
      </td>
      <td className="px-3 py-2">
        <TexteCompte compte={produit.compte_charge_interet} />
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
  produit,
  comptes,
  onFini,
  onAnnuler,
}: {
  produit: RattachementsProduit
  comptes: CompteSelecteur[]
  onFini: () => void
  onAnnuler: () => void
}) {
  const [compteEpargne, setCompteEpargne] = useState(produit.compte_epargne?.account_number ?? null)
  const [compteEpargneClient, setCompteEpargneClient] = useState(
    produit.compte_epargne_client?.account_number ?? null,
  )
  const [compteInteret, setCompteInteret] = useState(
    produit.compte_charge_interet?.account_number ?? null,
  )
  const [motif, setMotif] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      modifierRattachementsProduit(produit.id, {
        compte_epargne: compteEpargne,
        compte_epargne_client: compteEpargneClient,
        compte_charge_interet: compteInteret,
        motif: motif.trim(),
      }),
    onSuccess: onFini,
  })

  const motifValide = motif.trim().length >= 3
  const idBase = `re-${produit.id}`

  return (
    <tr className="border-b bg-brand-subtle/30 last:border-0">
      <td className="px-3 py-3 align-top">
        <span className="font-medium">{produit.name}</span>
        <span className="block font-mono text-xs text-muted-foreground">{produit.code}</span>
      </td>
      <td className="px-3 py-3 align-top">
        <SelectCompte
          id={`${idBase}-epargne`}
          label={P.colonneEpargne}
          comptes={comptes}
          valeur={compteEpargne}
          onChange={setCompteEpargne}
        />
      </td>
      <td className="px-3 py-3 align-top">
        <SelectCompte
          id={`${idBase}-client`}
          label={P.colonneEpargneClient}
          comptes={comptes}
          valeur={compteEpargneClient}
          onChange={setCompteEpargneClient}
        />
      </td>
      <td className="px-3 py-3 align-top">
        <SelectCompte
          id={`${idBase}-interet`}
          label={P.colonneInteret}
          comptes={comptes}
          valeur={compteInteret}
          onChange={setCompteInteret}
        />
      </td>
      <td className="px-3 py-3 align-top">
        <div className="space-y-2">
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
              disabled={!motifValide || mutation.isPending}
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
