import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  listerMapping,
  messageRefusCompte,
  modifierMapping,
  type LigneMappingAdmin,
  type MasseMapping,
} from '@/features/comptabilite/api'
import { LIBELLES } from '@/libelles/fr'

const M = LIBELLES.mappingEtatsFinanciers

const CLE_LISTE = ['comptabilite', 'etats', 'mapping']

const ETATS = ['BILAN', 'RESULTAT'] as const
const MASSES: MasseMapping[] = ['ACTIF', 'PASSIF', 'CONTRA_ACTIF', 'CHARGE', 'PRODUIT', 'MIXTE']

/**
 * Administration du mapping comptes -> postes d'états financiers (lot optionnel). Modifier une
 * ligne pose `gere_manuellement = TRUE` côté serveur : le prochain seed depuis le CSV ne la
 * réécrira plus jamais (même discipline que les rôles système).
 *
 * PAS DE PAGINATION SERVEUR (393 lignes, au-delà du seuil de 100 posé par la charte) — compromis
 * assumé pour cet écran optionnel ; un filtre texte limite la liste affichée en attendant. À
 * corriger si cet écran devient un livrable de premier rang plutôt qu'un outil d'appoint.
 */
export function PageMappingEtatsFinanciers() {
  const [filtre, setFiltre] = useState('')
  const [enEdition, setEnEdition] = useState<string | null>(null)

  const requete = useQuery({ queryKey: CLE_LISTE, queryFn: listerMapping })

  const lignes = (requete.data ?? []).filter((ligne) => {
    const recherche = filtre.trim().toLowerCase()
    if (!recherche) return true
    return (
      ligne.account_number.toLowerCase().includes(recherche) ||
      ligne.name.toLowerCase().includes(recherche) ||
      ligne.poste_libelle.toLowerCase().includes(recherche)
    )
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{M.titre}</h1>
        <p className="text-sm text-muted-foreground">{M.sousTitre}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/20 p-3">
        <div className="space-y-1">
          <Label htmlFor="mapping-filtre">Rechercher</Label>
          <Input
            id="mapping-filtre"
            value={filtre}
            onChange={(e) => setFiltre(e.target.value)}
            placeholder="Numéro, libellé ou poste…"
            className="w-64"
          />
        </div>
      </div>

      {requete.isPending ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{M.chargement}</p>
      ) : requete.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{M.erreur}</AlertDescription>
        </Alert>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{M.colCompte}</th>
                <th className="px-3 py-2 text-left font-medium">{M.colLibelle}</th>
                <th className="px-3 py-2 text-left font-medium">{M.colEtat}</th>
                <th className="px-3 py-2 text-left font-medium">{M.colMasse}</th>
                <th className="px-3 py-2 text-left font-medium">{M.colPoste}</th>
                <th className="px-3 py-2 text-right font-medium">{M.colOrdre}</th>
                <th className="px-3 py-2" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {lignes.map((ligne) =>
                enEdition === ligne.account_id ? (
                  <LigneEdition
                    key={ligne.account_id}
                    ligne={ligne}
                    onFini={() => setEnEdition(null)}
                    onAnnuler={() => setEnEdition(null)}
                  />
                ) : (
                  <LigneMapping
                    key={ligne.account_id}
                    ligne={ligne}
                    onModifier={() => setEnEdition(ligne.account_id)}
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

function LigneMapping({
  ligne,
  onModifier,
}: {
  ligne: LigneMappingAdmin
  onModifier: () => void
}) {
  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-2 font-mono text-xs">{ligne.account_number}</td>
      <td className="px-3 py-2">{ligne.name}</td>
      <td className="px-3 py-2">{ligne.etat}</td>
      <td className="px-3 py-2">{ligne.masse}</td>
      <td className="px-3 py-2">
        {ligne.poste_libelle}
        {ligne.gere_manuellement && (
          <span className="ml-2">
            <Badge ton="neutral">{M.gereManuellementBadge}</Badge>
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{ligne.poste_ordre}</td>
      <td className="px-3 py-2 text-right">
        <Button size="sm" variant="outline" onClick={onModifier}>
          {M.modifier}
        </Button>
      </td>
    </tr>
  )
}

function LigneEdition({
  ligne,
  onFini,
  onAnnuler,
}: {
  ligne: LigneMappingAdmin
  onFini: () => void
  onAnnuler: () => void
}) {
  const client = useQueryClient()
  const [etat, setEtat] = useState<'BILAN' | 'RESULTAT'>(ligne.etat)
  const [masse, setMasse] = useState<MasseMapping>(ligne.masse)
  const [posteLibelle, setPosteLibelle] = useState(ligne.poste_libelle)
  const [posteOrdre, setPosteOrdre] = useState(String(ligne.poste_ordre))

  const mutation = useMutation({
    mutationFn: () =>
      modifierMapping(ligne.account_id, {
        etat,
        masse,
        poste_libelle: posteLibelle.trim(),
        poste_ordre: Number.parseInt(posteOrdre, 10) || 0,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: CLE_LISTE })
      onFini()
    },
  })

  return (
    <tr className="border-b bg-muted/20 last:border-0">
      <td className="px-3 py-2 font-mono text-xs align-top">{ligne.account_number}</td>
      <td className="px-3 py-2 align-top">{ligne.name}</td>
      <td className="px-3 py-2 align-top">
        <select
          aria-label={M.champEtat}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={etat}
          onChange={(e) => setEtat(e.target.value as 'BILAN' | 'RESULTAT')}
        >
          {ETATS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 align-top">
        <select
          aria-label={M.champMasse}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={masse}
          onChange={(e) => setMasse(e.target.value as MasseMapping)}
        >
          {MASSES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 align-top">
        <Input
          aria-label={M.champPoste}
          value={posteLibelle}
          onChange={(e) => setPosteLibelle(e.target.value)}
        />
      </td>
      <td className="px-3 py-2 align-top">
        <Input
          aria-label={M.champOrdre}
          inputMode="numeric"
          className="w-20 text-right"
          value={posteOrdre}
          onChange={(e) => setPosteOrdre(e.target.value.replace(/\D/g, ''))}
        />
      </td>
      <td className="px-3 py-2 align-top">
        <div className="flex flex-col items-end gap-1">
          {mutation.isError && (
            <p className="text-xs text-danger">
              {messageRefusCompte(mutation.error, M.echec)}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || posteLibelle.trim() === ''}
            >
              {mutation.isPending ? M.enregistrementEnCours : M.enregistrer}
            </Button>
            <Button size="sm" variant="ghost" onClick={onAnnuler} disabled={mutation.isPending}>
              {M.annuler}
            </Button>
          </div>
        </div>
      </td>
    </tr>
  )
}
