import { useQuery } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { Landmark } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { chargerBilan, type Bilan, type LignePoste } from '@/features/comptabilite/api'
import { formatFcfa } from '@/features/epargne/api'
import { LIBELLES } from '@/libelles/fr'

const B = LIBELLES.bilan

function fmt(gabarit: string, valeurs: Record<string, string>): string {
  return gabarit.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '')
}

function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Bilan à une date — solde cumulé depuis l'origine de chaque compte (classes 1-5), via le
 * mapping comptes -> postes administré séparément. CONTRA_ACTIF (provisions, amortissements)
 * vient en DÉDUCTION de l'actif, jamais au passif. Un écart sur un exercice EN COURS n'est pas
 * nécessairement une anomalie : le résultat de la période n'entre dans les capitaux propres
 * qu'à la clôture — le bandeau le signale sans jamais le masquer.
 */
export function PageBilan() {
  const [date, setDate] = useState(aujourdhui)

  const requete = useQuery({
    queryKey: ['comptabilite', 'bilan', date],
    queryFn: () => chargerBilan(date),
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Landmark className="size-5 text-muted-foreground" />
          {B.titre}
        </h1>
        <p className="text-sm text-muted-foreground">{B.sousTitre}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/20 p-3">
        <div className="space-y-1">
          <Label htmlFor="bilan-date">{B.filtreDate}</Label>
          <Input
            id="bilan-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-auto"
          />
        </div>
      </div>

      {requete.isPending ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{B.chargement}</p>
      ) : requete.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {requete.error instanceof AxiosError && requete.error.response?.status === 403
              ? B.interdit
              : B.erreur}
          </AlertDescription>
        </Alert>
      ) : (
        <Contenu bilan={requete.data} />
      )}
    </div>
  )
}

function Contenu({ bilan }: { bilan: Bilan }) {
  return (
    <div className="space-y-4">
      {bilan.equilibre ? (
        <div
          role="status"
          className="rounded-md border border-success/50 bg-success-subtle/40 px-3 py-2 text-sm text-foreground"
        >
          {B.equilibre}
        </div>
      ) : (
        <div
          role="alert"
          className="space-y-1 rounded-md border border-danger/50 bg-danger-subtle/40 px-3 py-2 text-sm text-foreground"
        >
          <p>{fmt(B.desequilibre, { montant: formatFcfa(Math.abs(bilan.ecart)) })}</p>
          <p className="text-xs text-muted-foreground">{B.desequilibreNote}</p>
        </div>
      )}

      {bilan.comptes_non_mappes.length > 0 && (
        <div
          role="alert"
          className="space-y-2 rounded-md border border-danger/50 bg-danger-subtle/40 p-3"
        >
          <p className="text-sm font-medium">{B.comptesNonMappesTitre}</p>
          <p className="text-sm">
            {fmt(B.comptesNonMappesTexte, { n: String(bilan.comptes_non_mappes.length) })}
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 pr-2 font-medium">{B.colNonMappeCompte}</th>
                <th className="py-1 pr-2 font-medium">{B.colNonMappeLibelle}</th>
                <th className="py-1 text-right font-medium">{B.colNonMappeSolde}</th>
              </tr>
            </thead>
            <tbody>
              {bilan.comptes_non_mappes.map((c) => (
                <tr key={c.account_number}>
                  <td className="py-1 pr-2 font-mono text-xs">{c.account_number}</td>
                  <td className="py-1 pr-2">{c.name}</td>
                  <td className="py-1 text-right tabular-nums">{formatFcfa(c.solde)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <ColonnePostes
          titre={B.colonneActif}
          postes={bilan.actif}
          vide={B.videActif}
          lignesTotal={[
            { libelle: B.totalActifBrut, montant: bilan.total_actif_brut },
            { libelle: B.totalContraActif, montant: -bilan.total_contra_actif },
            { libelle: B.totalActifNet, montant: bilan.total_actif_net, accent: true },
          ]}
        />
        <ColonnePostes
          titre={B.colonnePassif}
          postes={bilan.passif}
          vide={B.videPassif}
          lignesTotal={[{ libelle: B.totalPassif, montant: bilan.total_passif, accent: true }]}
        />
      </div>
    </div>
  )
}

function ColonnePostes({
  titre,
  postes,
  vide,
  lignesTotal,
}: {
  titre: string
  postes: LignePoste[]
  vide: string
  lignesTotal: { libelle: string; montant: number; accent?: boolean }[]
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {titre}
      </p>
      {postes.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{vide}</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {postes.map((poste) => (
              <tr key={`${poste.masse}-${poste.poste_libelle}`} className="border-b last:border-0">
                <td className="py-1.5 pr-2">{poste.poste_libelle}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {poste.masse === 'CONTRA_ACTIF' ? '− ' : ''}
                  {formatFcfa(poste.montant)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-2 space-y-1 border-t pt-2 text-sm">
        {lignesTotal.map((ligne) => (
          <div
            key={ligne.libelle}
            className={`flex justify-between ${ligne.accent ? 'font-semibold' : 'text-muted-foreground'}`}
          >
            <span>{ligne.libelle}</span>
            <span className="tabular-nums">{formatFcfa(ligne.montant)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
