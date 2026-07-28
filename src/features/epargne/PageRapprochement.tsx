import { useQuery } from '@tanstack/react-query'
import { Scale } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { chargerRapprochement, formatFcfa } from '@/features/epargne/api'
import { LIBELLES } from '@/libelles/fr'

const R = LIBELLES.rapprochement

function fmt(gabarit: string, valeurs: Record<string, string>): string {
  return gabarit.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '')
}

/**
 * Rapprochement épargne ↔ comptabilité — vue de CONTRÔLE (auditeur / direction / comptable).
 * Pour chaque compte collectif : la somme des soldes d'épargne (auxiliaire) face au solde
 * comptable (général). Concordant en vert, écart en rouge AVEC le montant : c'est la première
 * chose qu'un contrôleur regarde, un écart étant le premier signe d'une anomalie. Vue RÉSEAU.
 */
export function PageRapprochement() {
  const requete = useQuery({ queryKey: ['epargne', 'rapprochement'], queryFn: chargerRapprochement })

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Scale className="size-5 text-muted-foreground" />
          {R.titre}
        </h1>
        <p className="text-sm text-muted-foreground">{R.intro}</p>
      </header>

      {requete.isPending ? (
        <p className="py-4 text-sm text-muted-foreground">{R.chargement}</p>
      ) : requete.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{R.erreur}</AlertDescription>
        </Alert>
      ) : requete.data.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">{R.vide}</p>
      ) : (
        <Rapprochement lignes={requete.data} />
      )}
    </div>
  )
}

function Rapprochement({ lignes }: { lignes: Awaited<ReturnType<typeof chargerRapprochement>> }) {
  const toutConcordant = lignes.every((l) => l.concordant)

  return (
    <div className="space-y-4">
      {/* Synthèse : tout concorde (vert), ou au moins un écart (rouge). */}
      {toutConcordant ? (
        <div
          role="status"
          className="rounded-md border border-success/50 bg-success-subtle/40 px-3 py-2 text-sm text-foreground"
        >
          {R.toutConcordant}
        </div>
      ) : (
        <div
          role="alert"
          className="rounded-md border border-danger/50 bg-danger-subtle/40 px-3 py-2 text-sm text-foreground"
        >
          {R.ecartsDetectes}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">{R.colCompte}</th>
              <th className="px-3 py-2 text-right font-medium">{R.colAuxiliaire}</th>
              <th className="px-3 py-2 text-right font-medium">{R.colGeneral}</th>
              <th className="px-3 py-2 font-medium">{R.colEtat}</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.compte_general} className="border-b last:border-0">
                <td className="px-3 py-2 font-mono">{l.compte_general}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatFcfa(l.auxiliaire)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatFcfa(l.general)}</td>
                <td className="px-3 py-2">
                  {l.concordant ? (
                    <Badge ton="success">{R.concordant}</Badge>
                  ) : (
                    <Badge ton="danger">
                      {fmt(R.ecart, { montant: formatFcfa(Math.abs(l.ecart)) })}
                    </Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
