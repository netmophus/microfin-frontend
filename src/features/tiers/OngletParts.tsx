import { useQuery } from '@tanstack/react-query'
import { Coins } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { chargerParts } from '@/features/tiers/api'
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
 * Onglet « Parts sociales » de la fiche tiers — LECTURE (bloc 1). Montre le capital détenu, les
 * parts (libérées / non libérées), l'état de sociétariat, le barème PROVISOIRE, et l'historique.
 * Rend LISIBLE le cas « client qui détient encore des parts » (remboursement partiel sous le
 * minimum) par un bandeau explicite. Les actions (souscrire/libérer/rembourser) viennent ensuite.
 */
export function OngletParts({ tierId }: { tierId: string }) {
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
            {P.valeurPart} : <span className="tabular-nums text-foreground">{fcfa(f.unit_value)}</span>
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
