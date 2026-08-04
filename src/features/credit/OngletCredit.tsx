import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Landmark, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAPermission } from '@/features/auth/useProfil'
import { BadgeStatutDossier } from '@/features/credit/badges'
import {
  creerDemandeCredit,
  listerDemandesCreditTier,
  listerProduitsCredit,
  messageRefusCredit,
} from '@/features/credit/api'
import { formatFcfa } from '@/features/epargne/api'
import { LIBELLES } from '@/libelles/fr'

const C = LIBELLES.credit

/**
 * Onglet « Crédit » de la fiche tiers (CR6a). Liste les dossiers DE CE TIERS — un vrai endpoint
 * cloisonné côté serveur (GET /tiers/{id}/demandes-credit), pas un filtrage client de la liste
 * réseau. La création est réservée (chargé de prêt) et gate KYC (tiers actif). Chaque dossier
 * ouvre sur sa vue détail (PageDossierCredit), où vivent décision/décaissement/échéancier.
 */
export function OngletCredit({ tierId, tierStatut }: { tierId: string; tierStatut: string }) {
  const peutCreer = useAPermission('credit.demande.create')
  const tierActif = tierStatut === 'actif'
  const [formulaireVisible, setFormulaireVisible] = useState(false)

  const requete = useQuery({
    queryKey: ['credit', 'demandes', 'tier', tierId],
    queryFn: () => listerDemandesCreditTier(tierId),
  })

  if (requete.isPending) {
    return <p className="py-4 text-sm text-muted-foreground">{C.chargement}</p>
  }
  if (requete.isError) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription>{C.erreur}</AlertDescription>
      </Alert>
    )
  }

  const dossiers = requete.data

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{C.titre}</h3>
        {peutCreer && tierActif && !formulaireVisible && (
          <Button size="sm" onClick={() => setFormulaireVisible(true)}>
            <Plus className="mr-1 size-4" />
            {C.nouvelleDemande}
          </Button>
        )}
      </div>

      {peutCreer && !tierActif && (
        <Alert role="note">
          <AlertDescription>{C.gateNonActif}</AlertDescription>
        </Alert>
      )}

      {formulaireVisible && (
        <FormulaireDemande tierId={tierId} onFini={() => setFormulaireVisible(false)} />
      )}

      {dossiers.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">{C.vide}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {dossiers.map((d) => (
            <li key={d.id}>
              <Link
                to={`/credit/${d.id}`}
                className="flex items-center justify-between gap-3 p-3 hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <Landmark className="size-5 text-muted-foreground" />
                  <div>
                    <p className="font-mono text-sm">{d.application_number}</p>
                    <p className="text-xs text-muted-foreground">{d.product_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums">
                    {formatFcfa(d.montant_demande)}
                  </span>
                  <BadgeStatutDossier statut={d.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormulaireDemande({ tierId, onFini }: { tierId: string; onFini: () => void }) {
  const client = useQueryClient()
  const [produitId, setProduitId] = useState('')
  const [montant, setMontant] = useState('')
  const [duree, setDuree] = useState('')
  const [objet, setObjet] = useState('')

  const produits = useQuery({ queryKey: ['credit', 'produits'], queryFn: listerProduitsCredit })

  const montantNum = Number.parseInt(montant.replace(/\D/g, ''), 10) || 0
  const dureeNum = Number.parseInt(duree.replace(/\D/g, ''), 10) || 0
  const pret = Boolean(produitId) && montantNum > 0 && dureeNum > 0

  const mutation = useMutation({
    mutationFn: () =>
      creerDemandeCredit(tierId, {
        product_id: produitId,
        montant_demande: montantNum,
        duree_echeances: dureeNum,
        objet: objet.trim() || undefined,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['credit', 'demandes', 'tier', tierId] })
      onFini()
    },
  })

  return (
    <form
      className="space-y-3 rounded-md border bg-brand-subtle/40 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (pret) mutation.mutate()
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="produit-credit">{C.produit}</Label>
        <select
          id="produit-credit"
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          value={produitId}
          onChange={(e) => setProduitId(e.target.value)}
        >
          <option value="">{C.produitChoisir}</option>
          {(produits.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.is_provisional ? C.produitProvisoireSuffixe : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="montant-demande-credit">{C.montantDemande}</Label>
        <Input
          id="montant-demande-credit"
          inputMode="numeric"
          value={montant}
          onChange={(e) => setMontant(e.target.value)}
          placeholder={C.montantPlaceholder}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="duree-echeances-credit">{C.dureeEcheances}</Label>
        <Input
          id="duree-echeances-credit"
          inputMode="numeric"
          value={duree}
          onChange={(e) => setDuree(e.target.value)}
          placeholder={C.dureePlaceholder}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="objet-credit">{C.objet}</Label>
        <Input
          id="objet-credit"
          value={objet}
          onChange={(e) => setObjet(e.target.value)}
          placeholder={C.objetPlaceholder}
        />
      </div>

      {mutation.isError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{messageRefusCredit(mutation.error, C.creationEchec)}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!pret || mutation.isPending}>
          {mutation.isPending ? C.creationEnCours : C.confirmerCreation}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onFini}>
          {C.annuler}
        </Button>
      </div>
    </form>
  )
}
