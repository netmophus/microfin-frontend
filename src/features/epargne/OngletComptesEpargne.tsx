import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PiggyBank, Plus } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useAPermission } from '@/features/auth/useProfil'
import {
  formatFcfa,
  listerComptesMembre,
  listerProduits,
  messageRefus,
  ouvrirCompte,
} from '@/features/epargne/api'
import { BadgeProvisoire, BadgeStatutCompte } from '@/features/epargne/badges'
import { LIBELLES } from '@/libelles/fr'

const E = LIBELLES.epargne

/**
 * Onglet « Comptes d'épargne » de la fiche membre. Liste les comptes (numéro, produit, solde en
 * francs, statut) et permet d'en OUVRIR un — mais seulement à un chargé/responsable ET sur un
 * membre ACTIF. Un prospect n'y a pas droit, et l'écran EXPLIQUE pourquoi le bouton est absent
 * (même logique que le gate d'activation KYC).
 */
export function OngletComptesEpargne({
  tierId,
  tierStatut,
}: {
  tierId: string
  tierStatut: string
}) {
  const peutOuvrir = useAPermission('epargne.account.open')
  const membreActif = tierStatut === 'actif'
  const [ouvertureVisible, setOuvertureVisible] = useState(false)

  const requete = useQuery({
    queryKey: ['epargne', 'comptes', tierId],
    queryFn: () => listerComptesMembre(tierId),
  })

  if (requete.isPending) {
    return <p className="py-4 text-sm text-muted-foreground">{E.chargement}</p>
  }
  if (requete.isError) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription>{E.erreur}</AlertDescription>
      </Alert>
    )
  }

  const comptes = requete.data

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{E.titre}</h3>
        {peutOuvrir && membreActif && !ouvertureVisible && (
          <Button size="sm" onClick={() => setOuvertureVisible(true)}>
            <Plus className="mr-1 size-4" />
            {E.ouvrir}
          </Button>
        )}
      </div>

      {/* Gate KYC visible : on DIT pourquoi l'ouverture est indisponible. */}
      {peutOuvrir && !membreActif && (
        <Alert role="note">
          <AlertDescription>{E.gateNonActif}</AlertDescription>
        </Alert>
      )}

      {ouvertureVisible && (
        <FormulaireOuverture
          tierId={tierId}
          onFini={() => setOuvertureVisible(false)}
        />
      )}

      {comptes.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">{E.vide}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {comptes.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 p-3">
              <div className="flex items-center gap-3">
                <PiggyBank className="size-5 text-muted-foreground" />
                <div>
                  <p className="font-mono text-sm">{c.account_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.product_name} {c.is_provisional && <BadgeProvisoire />}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold tabular-nums">{formatFcfa(c.balance)}</span>
                <BadgeStatutCompte statut={c.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormulaireOuverture({ tierId, onFini }: { tierId: string; onFini: () => void }) {
  const client = useQueryClient()
  const [produitId, setProduitId] = useState('')

  const produits = useQuery({ queryKey: ['epargne', 'produits'], queryFn: listerProduits })

  const mutation = useMutation({
    mutationFn: () => ouvrirCompte(tierId, produitId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['epargne', 'comptes', tierId] })
      onFini()
    },
  })

  return (
    <form
      className="space-y-3 rounded-md border bg-brand-subtle/40 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (produitId) mutation.mutate()
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="produit-epargne">{E.produit}</Label>
        <select
          id="produit-epargne"
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          value={produitId}
          onChange={(e) => setProduitId(e.target.value)}
        >
          <option value="">{E.produitChoisir}</option>
          {(produits.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.is_provisional ? E.produitProvisoireSuffixe : ''}
            </option>
          ))}
        </select>
      </div>

      {mutation.isError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{messageRefus(mutation.error, E.ouvertureEchec)}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!produitId || mutation.isPending}>
          {mutation.isPending ? E.ouvertureEnCours : E.confirmerOuverture}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onFini}>
          {E.annuler}
        </Button>
      </div>
    </form>
  )
}
