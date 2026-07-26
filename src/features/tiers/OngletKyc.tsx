import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAPermission } from '@/features/auth/useProfil'
import type { IndividuDetail } from '@/features/tiers/api'
import { BadgeRisque as BadgeRisqueBase } from '@/features/tiers/badges'
import { mettreAJourKyc, type ModeEntree, type PpeRelation } from '@/features/tiers/kyc'
import { listerSecteurs } from '@/features/tiers/referentiels'
import { LIBELLES } from '@/libelles/fr'

const K = LIBELLES.tiersKyc
const SELECT =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs disabled:opacity-50'

/** Niveau de risque (badge partagé) + AVERTISSEMENT si le barème est provisoire (non validé). */
function BadgeRisque({ niveau, provisoire }: { niveau: string | null; provisoire: boolean }) {
  if (!niveau) {
    return <p className="text-sm text-muted-foreground">{K.nonEvalue}</p>
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{K.niveauTitre} :</span>
        <BadgeRisqueBase niveau={niveau} />
      </div>
      {provisoire && (
        <Alert role="alert" className="border-warning/40 bg-warning-subtle">
          <AlertDescription className="text-warning">⚠️ {K.provisoire}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

export function OngletKyc({
  tierId,
  individu,
  riskLevel,
  riskProvisional,
}: {
  tierId: string
  individu: IndividuDetail | null | undefined
  riskLevel: string | null | undefined
  riskProvisional: boolean
}) {
  const peutSaisir = useAPermission('tiers.update')
  const queryClient = useQueryClient()
  const secteurs = useQuery({ queryKey: ['secteurs'], queryFn: listerSecteurs })

  const [origineFonds, setOrigineFonds] = useState(individu?.origine_fonds ?? '')
  const [secteurId, setSecteurId] = useState(individu?.secteur_activite_id ?? '')
  const [mode, setMode] = useState(individu?.mode_entree_relation ?? '')
  const [ppe, setPpe] = useState(individu?.ppe_status ?? false)
  const [ppeRelation, setPpeRelation] = useState(individu?.ppe_relation ?? '')
  const [ppeFonction, setPpeFonction] = useState(individu?.ppe_fonction ?? '')
  const [erreur, setErreur] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      mettreAJourKyc(tierId, {
        origine_fonds: origineFonds.trim() || null,
        secteur_activite_id: secteurId || null,
        ppe_status: ppe,
        ppe_relation: ppe ? ((ppeRelation || null) as PpeRelation | null) : null,
        ppe_fonction: ppe ? ppeFonction.trim() || null : null,
        mode_entree_relation: (mode || null) as ModeEntree | null,
      }),
    onSuccess: () => {
      setErreur(null)
      // Rafraîchit la fiche : badge de risque, bandeau des conditions, tout se met à jour.
      void queryClient.invalidateQueries({ queryKey: ['tiers'] })
    },
    onError: () => setErreur(K.erreur),
  })

  if (individu === null || individu === undefined) {
    return <p className="text-sm text-muted-foreground">{K.reservePP}</p>
  }

  return (
    <div className="space-y-5">
      <div className="rounded-md border p-3">
        <BadgeRisque niveau={riskLevel ?? null} provisoire={Boolean(riskProvisional)} />
      </div>

      <p className="text-sm text-muted-foreground">{K.intro}</p>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="kyc-origine">{K.origineFonds}</Label>
          <Input
            id="kyc-origine"
            value={origineFonds}
            onChange={(e) => setOrigineFonds(e.target.value)}
            placeholder={K.origineFondsPlaceholder}
            disabled={!peutSaisir}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="kyc-secteur">{K.secteur}</Label>
          <select
            id="kyc-secteur"
            className={SELECT}
            value={secteurId}
            disabled={!peutSaisir || secteurs.isError}
            onChange={(e) => setSecteurId(e.target.value)}
          >
            <option value="">{K.secteurChoisir}</option>
            {secteurs.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.libelle}
              </option>
            ))}
          </select>
          {secteurs.isError && <p className="text-sm text-destructive">{K.secteursIndisponibles}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="kyc-mode">{K.modeEntree}</Label>
          <select
            id="kyc-mode"
            className={SELECT}
            value={mode}
            disabled={!peutSaisir}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="">{K.modeChoisir}</option>
            {Object.entries(K.modes).map(([code, libelle]) => (
              <option key={code} value={code}>
                {libelle}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 rounded-md border p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={ppe}
              disabled={!peutSaisir}
              onChange={(e) => setPpe(e.target.checked)}
            />
            {K.ppe}
          </label>
          <p className="text-xs text-muted-foreground">{K.ppeAide}</p>
          {ppe && (
            <div className="grid gap-3 pt-1 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="kyc-ppe-relation">{K.ppeRelation}</Label>
                <select
                  id="kyc-ppe-relation"
                  className={SELECT}
                  value={ppeRelation}
                  disabled={!peutSaisir}
                  onChange={(e) => setPpeRelation(e.target.value)}
                >
                  <option value="">{K.modeChoisir}</option>
                  {Object.entries(K.ppeRelations).map(([code, libelle]) => (
                    <option key={code} value={code}>
                      {libelle}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kyc-ppe-fonction">{K.ppeFonction}</Label>
                <Input
                  id="kyc-ppe-fonction"
                  value={ppeFonction}
                  disabled={!peutSaisir}
                  onChange={(e) => setPpeFonction(e.target.value)}
                  placeholder={K.ppeFonctionPlaceholder}
                />
              </div>
            </div>
          )}
        </div>

        {erreur && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{erreur}</AlertDescription>
          </Alert>
        )}

        {peutSaisir && (
          <Button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? K.enCours : K.enregistrer}
          </Button>
        )}
      </div>
    </div>
  )
}
