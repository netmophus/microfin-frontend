import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, PiggyBank, Plus } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useAPermission } from '@/features/auth/useProfil'
import {
  fermerCompte,
  formatFcfa,
  lireCompte,
  listerComptesMembre,
  listerProduits,
  messageRefus,
  ouvrirCompte,
  type CompteEpargne,
} from '@/features/epargne/api'
import { BadgeProvisoire, BadgeStatutCompte } from '@/features/epargne/badges'
import { LIBELLES } from '@/libelles/fr'

const E = LIBELLES.epargne

function fmt(gabarit: string, valeurs: Record<string, string>): string {
  return gabarit.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '')
}

/**
 * Onglet « Comptes d'épargne » de la fiche membre. Liste les comptes ; l'ouverture est réservée
 * (chargé/responsable) et gate KYC (membre actif). Chaque compte se DÉPLIE en un panneau : relevé
 * des mouvements + fermeture (responsable, avec restitution affichée). Quand plus aucun compte
 * n'est ouvert, on DIT que le membre redevient désactivable (la boucle rendue lisible).
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
  const [ouvertId, setOuvertId] = useState<string | null>(null)

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
  const aUnCompteOuvert = comptes.some((c) => c.status === 'actif')

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

      {peutOuvrir && !membreActif && (
        <Alert role="note">
          <AlertDescription>{E.gateNonActif}</AlertDescription>
        </Alert>
      )}

      {ouvertureVisible && (
        <FormulaireOuverture tierId={tierId} onFini={() => setOuvertureVisible(false)} />
      )}

      {comptes.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">{E.vide}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {comptes.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-muted/50"
                onClick={() => setOuvertId(ouvertId === c.id ? null : c.id)}
                aria-expanded={ouvertId === c.id}
              >
                <div className="flex items-center gap-3">
                  {ouvertId === c.id ? (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 text-muted-foreground" />
                  )}
                  <PiggyBank className="size-5 text-muted-foreground" />
                  <div>
                    <p className="font-mono text-sm">{c.account_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.product_name} {c.is_provisional && <BadgeProvisoire />}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums">
                    {formatFcfa(c.balance)}
                  </span>
                  <BadgeStatutCompte statut={c.status} />
                </div>
              </button>
              {ouvertId === c.id && <PanneauCompte compte={c} tierId={tierId} />}
            </li>
          ))}
        </ul>
      )}

      {comptes.length > 0 && !aUnCompteOuvert && (
        <Alert role="status">
          <AlertDescription>{E.desactivable}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

function PanneauCompte({ compte, tierId }: { compte: CompteEpargne; tierId: string }) {
  const peutFermer = useAPermission('epargne.account.close')
  const detail = useQuery({
    queryKey: ['epargne', 'compte', compte.id],
    queryFn: () => lireCompte(compte.id),
  })

  return (
    <div className="space-y-3 border-t bg-muted/30 p-3">
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {E.releve}
        </p>
        {detail.isPending ? (
          <p className="text-sm text-muted-foreground">{E.chargementReleve}</p>
        ) : detail.isError || !detail.data ? (
          <p className="text-sm text-muted-foreground">{E.releveVide}</p>
        ) : detail.data.mouvements.length === 0 ? (
          <p className="text-sm text-muted-foreground">{E.releveVide}</p>
        ) : (
          <ul className="divide-y rounded-md border bg-background text-sm">
            {detail.data.mouvements.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span>
                  {new Date(m.created_at).toLocaleDateString('fr-FR')} ·{' '}
                  {E.operations[m.operation_type] ?? m.operation_type}
                  {m.entry_number && (
                    <span className="text-muted-foreground">
                      {' '}
                      · {E.piece} {m.entry_number}
                    </span>
                  )}
                </span>
                <span
                  className={
                    m.sens === 'credit'
                      ? 'font-semibold tabular-nums text-success'
                      : 'font-semibold tabular-nums text-danger'
                  }
                >
                  {m.sens === 'credit' ? '+' : '−'}
                  {formatFcfa(m.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {peutFermer && compte.status === 'actif' && (
        <FermetureCompte compte={compte} tierId={tierId} />
      )}
    </div>
  )
}

function FermetureCompte({ compte, tierId }: { compte: CompteEpargne; tierId: string }) {
  const client = useQueryClient()
  const [confirmation, setConfirmation] = useState(false)

  const fermeture = useMutation({
    mutationFn: () => fermerCompte(compte.id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['epargne', 'comptes', tierId] })
      void client.invalidateQueries({ queryKey: ['epargne', 'compte', compte.id] })
    },
  })

  if (!confirmation) {
    return (
      <Button size="sm" variant="outline" onClick={() => setConfirmation(true)}>
        {E.fermer}
      </Button>
    )
  }

  return (
    <div className="space-y-2 rounded-md border border-warning/40 bg-warning-subtle/40 p-3">
      {/* Restitution PROÉMINENTE avant de confirmer. */}
      <p className="text-sm font-medium">
        {compte.balance > 0
          ? fmt(E.fermetureRestitution, { montant: formatFcfa(compte.balance) })
          : E.fermetureSoldeNul}
      </p>
      {fermeture.isError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{messageRefus(fermeture.error, E.fermetureEchec)}</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => fermeture.mutate()} disabled={fermeture.isPending}>
          {fermeture.isPending ? E.fermetureEnCours : E.fermerConfirmer}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirmation(false)}>
          {E.annuler}
        </Button>
      </div>
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
