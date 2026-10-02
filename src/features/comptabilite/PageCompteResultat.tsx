import { useQuery } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { TrendingUp } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  chargerCompteResultat,
  listerExercices,
  type CompteResultatEtat,
  type LignePoste,
} from '@/features/comptabilite/api'
import { formatFcfa } from '@/features/epargne/api'
import { LIBELLES } from '@/libelles/fr'

const R = LIBELLES.compteResultat

function fmt(gabarit: string, valeurs: Record<string, string>): string {
  return gabarit.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '')
}

/**
 * Compte de résultat d'un exercice — agrégation des classes 6/7 sur la période s'il est en
 * cours, résultat RE-DÉRIVÉ depuis la pièce de clôture (591) s'il est clos (détail par poste
 * alors indisponible, `source_resultat` le signale explicitement à l'écran).
 */
export function PageCompteResultat() {
  const exercices = useQuery({ queryKey: ['comptabilite', 'exercices'], queryFn: listerExercices })
  const [exerciceId, setExerciceId] = useState('')

  const idEffectif = exerciceId || exercices.data?.[0]?.id || ''

  const requete = useQuery({
    queryKey: ['comptabilite', 'compte-resultat', idEffectif],
    queryFn: () => chargerCompteResultat(idEffectif),
    enabled: idEffectif !== '',
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <TrendingUp className="size-5 text-muted-foreground" />
          {R.titre}
        </h1>
        <p className="text-sm text-muted-foreground">{R.sousTitre}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/20 p-3">
        <div className="space-y-1">
          <Label htmlFor="cr-exercice">{R.selectionExercice}</Label>
          <select
            id="cr-exercice"
            className="h-9 w-auto min-w-48 rounded-md border border-input bg-background px-2 text-sm"
            value={idEffectif}
            onChange={(e) => setExerciceId(e.target.value)}
          >
            {(exercices.data ?? []).map((exercice) => (
              <option key={exercice.id} value={exercice.id}>
                {exercice.code} — {exercice.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {idEffectif === '' ? null : requete.isPending ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{R.chargement}</p>
      ) : requete.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {requete.error instanceof AxiosError && requete.error.response?.status === 403
              ? R.interdit
              : R.erreur}
          </AlertDescription>
        </Alert>
      ) : (
        <Contenu resultat={requete.data} />
      )}
    </div>
  )
}

function Contenu({ resultat }: { resultat: CompteResultatEtat }) {
  const excedent = resultat.resultat_net > 0
  const nul = resultat.resultat_net === 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge ton={nul ? 'neutral' : excedent ? 'success' : 'danger'}>
          {nul
            ? R.resultatNul
            : fmt(excedent ? R.resultatExcedent : R.resultatDeficit, {
                montant: formatFcfa(Math.abs(resultat.resultat_net)),
              })}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {resultat.source_resultat === 'cloture' ? R.sourceCloture : R.sourcePeriode}
        </span>
      </div>

      {resultat.comptes_non_mappes.length > 0 && (
        <div
          role="alert"
          className="space-y-2 rounded-md border border-danger/50 bg-danger-subtle/40 p-3"
        >
          <p className="text-sm font-medium">{R.comptesNonMappesTitre}</p>
          <p className="text-sm">
            {fmt(R.comptesNonMappesTexte, { n: String(resultat.comptes_non_mappes.length) })}
          </p>
          <table className="w-full text-sm">
            <tbody>
              {resultat.comptes_non_mappes.map((c) => (
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
          titre={R.colonneCharges}
          postes={resultat.charges}
          vide={R.videCharges}
          total={{ libelle: R.totalCharges, montant: resultat.total_charges }}
        />
        <ColonnePostes
          titre={R.colonneProduits}
          postes={resultat.produits}
          vide={R.videProduits}
          total={{ libelle: R.totalProduits, montant: resultat.total_produits }}
        />
      </div>
    </div>
  )
}

function ColonnePostes({
  titre,
  postes,
  vide,
  total,
}: {
  titre: string
  postes: LignePoste[]
  vide: string
  total: { libelle: string; montant: number }
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
              <tr key={poste.poste_libelle} className="border-b last:border-0">
                <td className="py-1.5 pr-2">{poste.poste_libelle}</td>
                <td className="py-1.5 text-right tabular-nums">{formatFcfa(poste.montant)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-2 flex justify-between border-t pt-2 text-sm font-semibold">
        <span>{total.libelle}</span>
        <span className="tabular-nums">{formatFcfa(total.montant)}</span>
      </div>
    </div>
  )
}
