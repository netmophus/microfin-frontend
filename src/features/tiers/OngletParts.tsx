import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Coins } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAPermission } from '@/features/auth/useProfil'
import {
  chargerParts,
  libererParts,
  messageRefusParts,
  souscrireComptant,
  souscrireParts,
  type FichePartsSociales,
} from '@/features/tiers/api'
import { BadgeSocietariat } from '@/features/tiers/badges'
import { LIBELLES } from '@/libelles/fr'

const P = LIBELLES.tiersParts

/** Francs CFA entiers, séparateur de milliers, jamais de décimale. Ex. « 50 000 F ». */
function fcfa(montant: number): string {
  return `${montant.toLocaleString('fr-FR')} F`
}

function fmt(gabarit: string, valeurs: Record<string, string>): string {
  return gabarit.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '')
}

/**
 * Onglet « Parts sociales » — consultation + actions (« devenir membre »). Séparation des rôles :
 * souscription (engagement) = chargé de clientèle ; libération / comptant (encaissement) =
 * caissier ; remboursement = responsable (bloc suivant). Au comptant / à la libération, le badge
 * Client → Membre bascule sous les yeux (invalidation de la fiche). Le cas « client qui détient
 * encore des parts » est rendu LISIBLE par un bandeau.
 */
export function OngletParts({ tierId, tierStatut }: { tierId: string; tierStatut: string }) {
  const requete = useQuery({
    queryKey: ['tiers', 'parts', tierId],
    queryFn: () => chargerParts(tierId),
  })

  if (requete.isPending) {
    return <p className="py-4 text-sm text-muted-foreground">{P.chargement}</p>
  }
  if (requete.isError || !requete.data) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription>{P.erreur}</AlertDescription>
      </Alert>
    )
  }

  const f = requete.data
  const detientDesParts = f.shares_liberees + f.shares_non_liberees > 0

  return (
    <div className="space-y-4">
      {/* Capital + état de sociétariat. */}
      <div className="flex items-start justify-between gap-4 rounded-md border bg-card p-4">
        <div className="flex items-start gap-3">
          <Coins className="mt-1 size-6 text-muted-foreground" />
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {P.capitalLibere}
            </p>
            <p className="text-xl font-semibold tabular-nums">{fcfa(f.capital_libere)}</p>
            <p className="text-sm text-muted-foreground">{P.partsLiberees(f.shares_liberees)}</p>
            {f.shares_non_liberees > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                {P.partsNonLiberees(f.shares_non_liberees)} · {P.capitalNonLibere}{' '}
                {fcfa(f.capital_non_libere)}
              </p>
            )}
          </div>
        </div>
        <BadgeSocietariat isMember={f.is_member} />
      </div>

      {/* Cas LISIBLE : client qui détient encore des parts (partiel sous le minimum). */}
      {!f.is_member && detientDesParts && (
        <Alert role="note">
          <AlertDescription>
            {fmt(P.ancienSocietaire, {
              parts: P.partsLiberees(f.shares_liberees),
              capital: fcfa(f.capital_libere),
            })}
          </AlertDescription>
        </Alert>
      )}

      {/* Actions : souscrire / libérer (« devenir membre »). */}
      <ActionsParts tierId={tierId} tierStatut={tierStatut} fiche={f} />

      {/* Barème PROVISOIRE (valeur d'une part, minimum) — non validé par l'expert. */}
      <div className="rounded-md border p-3 text-sm">
        <div className="mb-1 flex items-center gap-2">
          <span className="font-medium">{P.baremeTitre}</span>
          {f.is_provisional && (
            <span title={P.provisoireAide}>
              <Badge ton="warning">provisoire</Badge>
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-1 text-muted-foreground">
          <span>
            {P.valeurPart} :{' '}
            <span className="tabular-nums text-foreground">{fcfa(f.unit_value)}</span>
          </span>
          <span>
            {P.minimum} :{' '}
            <span className="text-foreground">{P.minimumValeur(f.minimum_shares)}</span>
          </span>
        </div>
      </div>

      {/* Historique des mouvements de parts. */}
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {P.historique}
        </p>
        {f.mouvements.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            {detientDesParts ? P.historiqueVide : P.aucune}
          </p>
        ) : (
          <ul className="divide-y rounded-md border bg-background text-sm">
            {f.mouvements.map((m, i) => (
              <li
                key={`${m.created_at}-${i}`}
                className="flex items-center justify-between gap-2 px-3 py-2"
              >
                <span>
                  {new Date(m.created_at).toLocaleDateString('fr-FR')} ·{' '}
                  {P.operations[m.type] ?? m.type}
                  {' · '}
                  {m.shares_count} {m.shares_count > 1 ? 'parts' : 'part'}
                  {m.entry_number && (
                    <span className="text-muted-foreground">
                      {' '}
                      · {P.piece} {m.entry_number}
                    </span>
                  )}
                </span>
                <span className="font-semibold tabular-nums">{fcfa(m.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

type Mode = 'comptant' | 'engagement' | 'liberation'

function ActionsParts({
  tierId,
  tierStatut,
  fiche,
}: {
  tierId: string
  tierStatut: string
  fiche: FichePartsSociales
}) {
  const client = useQueryClient()
  const peutPayer = useAPermission('tiers.shares.pay') // caissier : encaisse
  const peutSouscrire = useAPermission('tiers.shares.subscribe') // chargé : engagement
  const [mode, setMode] = useState<Mode | null>(null)
  const [nb, setNb] = useState('')
  const [confirmation, setConfirmation] = useState(false)
  const [succes, setSucces] = useState<string | null>(null)

  const nbNum = Number.parseInt(nb.replace(/\D/g, ''), 10) || 0
  const total = nbNum * fiche.unit_value

  const mutation = useMutation({
    mutationFn: () => {
      if (mode === 'comptant') return souscrireComptant(tierId, nbNum)
      if (mode === 'engagement') return souscrireParts(tierId, nbNum)
      return libererParts(tierId, nbNum)
    },
    onSuccess: (res) => {
      // Invalide la fiche (le badge Client/Membre en tête) ET les parts : la bascule est visible.
      void client.invalidateQueries({ queryKey: ['tiers'] })
      setSucces(res.is_member ? P.succesMembre : P.succesEngagement)
      setMode(null)
      setNb('')
      setConfirmation(false)
    },
  })

  // Aucun droit d'action : rien (la consultation reste visible au-dessus).
  if (!peutPayer && !peutSouscrire) return null

  // Réservé au tiers ACTIF (gate KYC) — on l'explique, comme l'ouverture d'un compte d'épargne.
  if (tierStatut !== 'actif') {
    return (
      <Alert role="note">
        <AlertDescription>{P.gateNonActif}</AlertDescription>
      </Alert>
    )
  }

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

  const gabaritTotal = mode === 'engagement' ? P.totalSouscrit : P.totalAPayer
  const gabaritConfirme =
    mode === 'comptant'
      ? P.confirmerComptant
      : mode === 'engagement'
        ? P.confirmerEngagement
        : P.confirmerLiberation

  return (
    <section className="space-y-3 rounded-md border p-4">
      {/* Choix de l'action selon le rôle et l'état. */}
      {!mode && (
        <div className="flex flex-wrap gap-2">
          {peutPayer && (
            <Button size="sm" onClick={() => setMode('comptant')}>
              {P.actionComptant}
            </Button>
          )}
          {peutSouscrire && (
            <Button size="sm" variant="outline" onClick={() => setMode('engagement')}>
              {P.actionEngagement}
            </Button>
          )}
          {peutPayer && fiche.shares_non_liberees > 0 && (
            <Button size="sm" variant="outline" onClick={() => setMode('liberation')}>
              {P.actionLiberer}
            </Button>
          )}
        </div>
      )}

      {/* Saisie guidée : combien de parts -> total. */}
      {mode && !confirmation && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (nbNum > 0) setConfirmation(true)
          }}
        >
          <Label htmlFor="nb-parts">{P.nbParts}</Label>
          <Input
            id="nb-parts"
            inputMode="numeric"
            value={nb}
            onChange={(e) => setNb(e.target.value)}
            placeholder={P.nbPartsPlaceholder}
          />
          {nbNum > 0 && (
            <p className="text-sm text-muted-foreground">
              {fmt(gabaritTotal, {
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

      {/* Confirmation — on répète le geste et son effet (le badge va basculer). */}
      {mode && confirmation && (
        <div className="space-y-3 rounded-md border border-brand/40 bg-brand-subtle/40 p-3">
          <p className="text-sm font-medium">
            {fmt(gabaritConfirme, { parts: String(nbNum), total: fcfa(total) })}
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
    </section>
  )
}
