import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { listerSessionsManquantes } from '@/features/caisse/api'
import { formatFcfa } from '@/features/epargne/api'
import { LIBELLES } from '@/libelles/fr'

const S = LIBELLES.sessionsManquantes
const TAILLE_PAGE = 25

function fmt(gabarit: string, valeurs: Record<string, string>): string {
  return gabarit.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '')
}

function dateHeure(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Liste des sessions de caisse fermées avec un MANQUANT — pour retrouver et réimprimer une
 * lettre de demande d'explication plus tard, sans dépendre d'un lien reçu au moment de la
 * fermeture. Le périmètre (les siennes, ou celles de son agence/réseau) est décidé côté
 * serveur (caisse.session.read vs .read.autres) — cet écran affiche ce qui revient, rien de
 * plus : un caissier ne voit ici QUE les siennes, un responsable/audit/direction voit large.
 */
export function PageSessionsManquantes() {
  const [page, setPage] = useState(1)

  const requete = useQuery({
    queryKey: ['caisse', 'sessions-manquantes', page],
    queryFn: () => listerSessionsManquantes(page, TAILLE_PAGE),
  })

  const totalPages = requete.data ? Math.max(1, Math.ceil(requete.data.total / TAILLE_PAGE)) : 1

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <AlertTriangle className="size-5 text-muted-foreground" />
          {S.titre}
        </h1>
        <p className="text-sm text-muted-foreground">{S.intro}</p>
      </header>

      {requete.isPending ? (
        <p className="py-4 text-sm text-muted-foreground">{S.chargement}</p>
      ) : requete.isError ? (
        <div className="space-y-3">
          <Alert variant="destructive" role="alert">
            <AlertDescription>{S.erreur}</AlertDescription>
          </Alert>
          <Button variant="outline" onClick={() => requete.refetch()}>
            {S.reessayer}
          </Button>
        </div>
      ) : requete.data.lignes.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">{S.vide}</p>
      ) : (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">{S.colCaissier}</th>
                  <th className="px-3 py-2 font-medium">{S.colAgence}</th>
                  <th className="px-3 py-2 font-medium">{S.colFermeeLe}</th>
                  <th className="px-3 py-2 text-right font-medium">{S.colEcart}</th>
                  <th className="px-3 py-2 font-medium" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {requete.data.lignes.map((ligne) => (
                  <tr key={ligne.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{ligne.caissier_nom}</td>
                    <td className="px-3 py-2">{ligne.agency_nom}</td>
                    <td className="px-3 py-2 tabular-nums">{dateHeure(ligne.closed_at)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-danger">
                      {formatFcfa(Math.abs(ligne.ecart))}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        to={`/caisse/sessions/${ligne.id}/lettre`}
                        className="text-primary hover:underline"
                      >
                        {S.voirLaLettre}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>{fmt(S.pagination, { page: String(page), total: String(totalPages) })}</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p - 1)}
                disabled={page <= 1}
              >
                {S.pagePrecedente}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
              >
                {S.pageSuivante}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
