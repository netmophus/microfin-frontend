import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAPermission } from '@/features/auth/useProfil'
import {
  listerComptesSelecteur,
  listerRattachementsAgences,
  messageRefusCompte,
  modifierCompteCaisse,
  type AgenceRattachement,
  type CompteSelecteur,
} from '@/features/comptabilite/api'
import { LIBELLES } from '@/libelles/fr'

const P = LIBELLES.rattachementsCaisse

function fmt(gabarit: string, valeurs: Record<string, string>): string {
  return gabarit.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '')
}

/**
 * Rattachement du compte de caisse par agence (Bloc 5). Même patron que les rattachements
 * épargne (une ligne à la fois en édition), réduit à un seul sélecteur.
 */
export function PageRattachementsCaisse() {
  const client = useQueryClient()
  const [enEdition, setEnEdition] = useState<string | null>(null)
  const peutGerer = useAPermission('compta.plan.manage')

  const agences = useQuery({
    queryKey: ['comptabilite', 'rattachements-caisse'],
    queryFn: listerRattachementsAgences,
  })
  const comptes = useQuery({
    queryKey: ['comptabilite', 'comptes-selecteur'],
    queryFn: () => listerComptesSelecteur(),
    enabled: peutGerer,
  })

  const rafraichir = () => {
    setEnEdition(null)
    void client.invalidateQueries({ queryKey: ['comptabilite', 'rattachements-caisse'] })
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{P.titre}</h1>
        <p className="text-sm text-muted-foreground">{P.sousTitre}</p>
      </div>

      <Alert>
        <AlertDescription>{P.avertissement}</AlertDescription>
      </Alert>

      {agences.isPending ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{P.chargement}</p>
      ) : agences.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {agences.error instanceof AxiosError && agences.error.response?.status === 403
              ? P.interdit
              : P.erreur}
          </AlertDescription>
        </Alert>
      ) : agences.data.length === 0 ? (
        <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
          {P.listeVide}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{P.colonneAgence}</th>
                <th className="px-3 py-2 text-left font-medium">{P.colonneCaisse}</th>
                {peutGerer && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {agences.data.map((agence) =>
                enEdition === agence.id && comptes.data ? (
                  <LigneEdition
                    key={agence.id}
                    agence={agence}
                    comptes={comptes.data}
                    onFini={rafraichir}
                    onAnnuler={() => setEnEdition(null)}
                  />
                ) : (
                  <LigneLecture
                    key={agence.id}
                    agence={agence}
                    peutGerer={peutGerer}
                    onModifier={() => setEnEdition(agence.id)}
                  />
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function LigneLecture({
  agence,
  peutGerer,
  onModifier,
}: {
  agence: AgenceRattachement
  peutGerer: boolean
  onModifier: () => void
}) {
  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-2">
        <span className="font-medium">{agence.name}</span>
        <span className="ml-2 font-mono text-xs text-muted-foreground">{agence.code}</span>
      </td>
      <td className="px-3 py-2">
        {agence.compte_caisse ? (
          <span className="font-mono text-xs">
            {agence.compte_caisse.account_number} — {agence.compte_caisse.name}
          </span>
        ) : (
          <span className="text-muted-foreground">{P.aucun}</span>
        )}
        {agence.postes_divergents.length > 0 && (
          <p role="note" className="mt-1 text-xs text-warning">
            {fmt(P.divergence, {
              postes: agence.postes_divergents
                .map((poste) =>
                  poste.compte_caisse
                    ? `« ${poste.libelle} » (${poste.compte_caisse.account_number})`
                    : `« ${poste.libelle} » (non rattaché)`,
                )
                .join(', '),
            })}
          </p>
        )}
      </td>
      {peutGerer && (
        <td className="px-3 py-2 text-right">
          <Button size="sm" variant="outline" onClick={onModifier}>
            {P.modifier}
          </Button>
        </td>
      )}
    </tr>
  )
}

function LigneEdition({
  agence,
  comptes,
  onFini,
  onAnnuler,
}: {
  agence: AgenceRattachement
  comptes: CompteSelecteur[]
  onFini: () => void
  onAnnuler: () => void
}) {
  const [compteCaisse, setCompteCaisse] = useState(agence.compte_caisse?.account_number ?? null)
  const [motif, setMotif] = useState('')

  const mutation = useMutation({
    mutationFn: () => modifierCompteCaisse(agence.id, compteCaisse, motif.trim()),
    onSuccess: onFini,
  })

  const motifValide = motif.trim().length >= 3
  const idBase = `rc-${agence.id}`

  return (
    <tr className="border-b bg-brand-subtle/30 last:border-0">
      <td className="px-3 py-3 align-top">
        <span className="font-medium">{agence.name}</span>
        <span className="block font-mono text-xs text-muted-foreground">{agence.code}</span>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="space-y-1">
          <Label htmlFor={`${idBase}-caisse`}>{P.colonneCaisse}</Label>
          <select
            id={`${idBase}-caisse`}
            className="h-9 w-full rounded-md border bg-background px-2 text-xs"
            value={compteCaisse ?? ''}
            onChange={(e) => setCompteCaisse(e.target.value || null)}
          >
            <option value="">{P.aucun}</option>
            {comptes.map((c) => (
              <option key={c.id} value={c.account_number}>
                {c.account_number} — {c.name}
              </option>
            ))}
          </select>
        </div>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="space-y-2">
          <div className="space-y-1">
            <Label htmlFor={`${idBase}-motif`}>{P.motif}</Label>
            <Input
              id={`${idBase}-motif`}
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder={P.motifPlaceholder}
            />
          </div>
          {mutation.isError && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{messageRefusCompte(mutation.error, P.echec)}</AlertDescription>
            </Alert>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!motifValide || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? P.enregistrementEnCours : P.enregistrer}
            </Button>
            <Button size="sm" variant="ghost" onClick={onAnnuler}>
              {P.annuler}
            </Button>
          </div>
        </div>
      </td>
    </tr>
  )
}
