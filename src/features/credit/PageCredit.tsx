import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { BadgeStatutDossier } from '@/features/credit/badges'
import { listerDemandesCredit } from '@/features/credit/api'
import { formatFcfa } from '@/features/epargne/api'
import { LIBELLES } from '@/libelles/fr'

const C = LIBELLES.credit

const STATUTS_FILTRE = ['en_instruction', 'approuve', 'refuse', 'decaisse'] as const

/**
 * Liste réseau des dossiers de crédit (CR6a) — le point d'entrée du menu « Crédit ». Chaque
 * ligne mène à la vue détail du dossier (décision/décaissement/échéancier y vivent). La
 * création, elle, se fait sur la fiche du tiers (OngletCredit), pas ici.
 */
export function PageCredit() {
  const [filtreStatut, setFiltreStatut] = useState('tous')
  const naviguer = useNavigate()

  const requete = useQuery({ queryKey: ['credit', 'demandes'], queryFn: listerDemandesCredit })

  const dossiers = (requete.data ?? []).filter(
    (d) => filtreStatut === 'tous' || d.status === filtreStatut,
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{C.listeTitre}</h1>
        <p className="text-sm text-muted-foreground">{C.listeSousTitre}</p>
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="filtre-statut-credit">{C.filtrerParStatut}</Label>
        <select
          id="filtre-statut-credit"
          className="h-9 rounded-md border bg-background px-3 text-sm"
          value={filtreStatut}
          onChange={(e) => setFiltreStatut(e.target.value)}
        >
          <option value="tous">{C.filtreTous}</option>
          {STATUTS_FILTRE.map((s) => (
            <option key={s} value={s}>
              {C.statuts[s]}
            </option>
          ))}
        </select>
      </div>

      {requete.isPending && (
        <p className="py-8 text-center text-sm text-muted-foreground">{C.chargement}</p>
      )}

      {requete.isError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{C.erreurListe}</AlertDescription>
        </Alert>
      )}

      {requete.isSuccess && dossiers.length === 0 && (
        <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
          {C.listeVide}
        </p>
      )}

      {requete.isSuccess && dossiers.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{C.colonneNumero}</th>
                <th className="px-3 py-2 text-left font-medium">{C.colonneTiers}</th>
                <th className="px-3 py-2 text-left font-medium">{C.colonneProduit}</th>
                <th className="px-3 py-2 text-right font-medium">{C.colonneMontant}</th>
                <th className="px-3 py-2 text-left font-medium">{C.colonneStatut}</th>
              </tr>
            </thead>
            <tbody>
              {dossiers.map((d) => (
                <tr
                  key={d.id}
                  tabIndex={0}
                  role="button"
                  onClick={() => void naviguer(`/credit/${d.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void naviguer(`/credit/${d.id}`)
                  }}
                  className="cursor-pointer border-b last:border-0 hover:bg-muted/30 focus:bg-muted/50 focus:outline-none"
                >
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-muted-foreground">
                    {d.application_number}
                  </td>
                  <td className="px-3 py-2">
                    {d.tier_nom}{' '}
                    <span className="font-mono text-xs text-muted-foreground">
                      ({d.tier_number})
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{d.product_name}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {formatFcfa(d.montant_demande)}
                  </td>
                  <td className="px-3 py-2">
                    <BadgeStatutDossier statut={d.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
