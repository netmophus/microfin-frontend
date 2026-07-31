import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Coins, Search } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  chargerParts,
  libererParts,
  listerTiers,
  messageRefusParts,
  souscrireComptant,
  type FichePartsSociales,
  type LigneTier,
} from '@/features/tiers/api'
import { BadgeSocietariat } from '@/features/tiers/badges'
import { LIBELLES } from '@/libelles/fr'

const G = LIBELLES.guichetParts
const P = LIBELLES.tiersParts

function fcfa(montant: number): string {
  return `${montant.toLocaleString('fr-FR')} F`
}

function fmt(gabarit: string, valeurs: Record<string, string>): string {
  return gabarit.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '')
}

/**
 * Onglet « Parts sociales » du guichet — l'encaissement du caissier : souscrire au comptant (un
 * nouveau sociétaire qui paie cash, en UNE visite — sans ça, le circuit forcerait à passer par un
 * engagement chez le chargé PUIS un retour pour la libération) et libérer des parts déjà
 * souscrites. Recherche par numéro OU nom (comme la liste des tiers) — pas de fusion avec la
 * recherche par compte de l'onglet Épargne, les deux clés sont naturellement différentes.
 * Le NOM est proéminent avant toute opération, comme au guichet épargne.
 */
export function OngletGuichetParts() {
  const [tier, setTier] = useState<LigneTier | null>(null)

  return (
    <div className="mx-auto max-w-xl space-y-5 p-4">
      <p className="text-sm text-muted-foreground">{G.intro}</p>

      {!tier ? (
        <Recherche onSelection={setTier} />
      ) : (
        <FicheGuichet tier={tier} onChangerRecherche={() => setTier(null)} />
      )}
    </div>
  )
}

function Recherche({ onSelection }: { onSelection: (t: LigneTier) => void }) {
  const [q, setQ] = useState('')
  const recherche = useMutation({
    mutationFn: () => listerTiers({ q: q.trim() }),
  })

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (q.trim()) recherche.mutate()
      }}
    >
      <Label htmlFor="recherche-tiers-parts">{G.rechercherLabel}</Label>
      <div className="flex gap-2">
        <Input
          id="recherche-tiers-parts"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={G.rechercherPlaceholder}
        />
        <Button type="submit" disabled={!q.trim() || recherche.isPending}>
          <Search className="mr-1 size-4" />
          {recherche.isPending ? G.rechercheEnCours : G.chercher}
        </Button>
      </div>

      {recherche.isSuccess && recherche.data.lignes.length === 0 && (
        <Alert role="alert">
          <AlertDescription>{G.aucunResultat}</AlertDescription>
        </Alert>
      )}

      {recherche.isSuccess && recherche.data.lignes.length > 0 && (
        <ul className="divide-y rounded-md border bg-background text-sm">
          {recherche.data.lignes.map((ligne) => (
            <li key={ligne.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-muted/50"
                onClick={() => onSelection(ligne)}
              >
                <span>
                  <span className="font-medium">{ligne.display_name}</span>{' '}
                  <span className="font-mono text-xs text-muted-foreground">
                    {ligne.tier_number}
                  </span>
                </span>
                <BadgeSocietariat isMember={ligne.is_member} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  )
}

function FicheGuichet({
  tier,
  onChangerRecherche,
}: {
  tier: LigneTier
  onChangerRecherche: () => void
}) {
  const requete = useQuery({
    queryKey: ['guichet', 'parts', tier.id],
    queryFn: () => chargerParts(tier.id),
  })

  return (
    <section className="space-y-4 rounded-md border p-4">
      {/* Le tiers, et surtout son NOM, en évidence — vérification humaine avant l'encaissement. */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Coins className="mt-1 size-6 text-muted-foreground" />
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{G.tiers}</p>
            <p className="text-lg font-bold">{tier.display_name}</p>
            <p className="font-mono text-sm text-muted-foreground">{tier.tier_number}</p>
          </div>
        </div>
        {requete.data && <BadgeSocietariat isMember={requete.data.is_member} />}
      </div>

      {requete.isPending ? (
        <p className="text-sm text-muted-foreground">{P.chargement}</p>
      ) : requete.isError || !requete.data ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{P.erreur}</AlertDescription>
        </Alert>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {P.capitalLibere} : <span className="font-medium text-foreground">
              {fcfa(requete.data.capital_libere)}
            </span>{' '}
            ({P.partsLiberees(requete.data.shares_liberees)})
          </p>

          {tier.status !== 'actif' ? (
            <Alert role="note">
              <AlertDescription>{P.gateNonActif}</AlertDescription>
            </Alert>
          ) : (
            <Actions tierId={tier.id} nom={tier.display_name} fiche={requete.data} />
          )}
        </>
      )}

      <Button size="sm" variant="ghost" onClick={onChangerRecherche}>
        {G.changerRecherche}
      </Button>
    </section>
  )
}

type Mode = 'comptant' | 'liberation'

function Actions({
  tierId,
  nom,
  fiche,
}: {
  tierId: string
  nom: string
  fiche: FichePartsSociales
}) {
  const client = useQueryClient()
  const [mode, setMode] = useState<Mode | null>(null)
  const [nb, setNb] = useState('')
  const [confirmation, setConfirmation] = useState(false)
  const [succes, setSucces] = useState<string | null>(null)

  const nbNum = Number.parseInt(nb.replace(/\D/g, ''), 10) || 0
  const total = nbNum * fiche.unit_value

  const mutation = useMutation({
    mutationFn: () =>
      mode === 'comptant' ? souscrireComptant(tierId, nbNum) : libererParts(tierId, nbNum),
    onSuccess: (res) => {
      void client.invalidateQueries({ queryKey: ['guichet', 'parts', tierId] })
      void client.invalidateQueries({ queryKey: ['tiers', 'parts', tierId] })
      setSucces(res.is_member ? P.succesMembre : P.succesEngagement)
      setMode(null)
      setNb('')
      setConfirmation(false)
    },
  })

  if (succes) {
    return (
      <Alert role="status">
        <AlertDescription className="space-y-2">
          <p>{succes}</p>
          <Button size="sm" variant="ghost" onClick={() => setSucces(null)}>
            {P.autreOperation}
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const gabaritConfirme = mode === 'comptant' ? G.confirmerComptant : G.confirmerLiberation

  return (
    <div className="space-y-3">
      {!mode && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setMode('comptant')}>
            {P.actionComptant}
          </Button>
          {fiche.shares_non_liberees > 0 && (
            <Button size="sm" variant="outline" onClick={() => setMode('liberation')}>
              {P.actionLiberer}
            </Button>
          )}
        </div>
      )}

      {mode && !confirmation && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (nbNum > 0) setConfirmation(true)
          }}
        >
          <Label htmlFor="nb-parts-guichet">{P.nbParts}</Label>
          <Input
            id="nb-parts-guichet"
            inputMode="numeric"
            value={nb}
            onChange={(e) => setNb(e.target.value)}
            placeholder={P.nbPartsPlaceholder}
          />
          {nbNum > 0 && (
            <p className="text-sm text-muted-foreground">
              {fmt(P.totalAPayer, {
                parts: String(nbNum),
                valeur: fcfa(fiche.unit_value),
                total: fcfa(total),
              })}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={nbNum <= 0}>
              {P.continuer}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setMode(null)
                setNb('')
              }}
            >
              {P.annuler}
            </Button>
          </div>
        </form>
      )}

      {mode && confirmation && (
        <div className="space-y-3 rounded-md border border-brand/40 bg-brand-subtle/40 p-3">
          <p className="text-sm font-medium">
            {fmt(gabaritConfirme, { parts: String(nbNum), total: fcfa(total), nom })}
          </p>
          {mutation.isError && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{messageRefusParts(mutation.error, P.echec)}</AlertDescription>
            </Alert>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? P.enCours : P.confirmer}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmation(false)}
              disabled={mutation.isPending}
            >
              {P.annuler}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
