import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  lireParametresCaisse,
  modifierParametresCaisse,
  type ParametresCaisse,
} from '@/features/caisse/api'
import { useAPermission } from '@/features/auth/useProfil'
import { formatFcfa } from '@/features/epargne/api'
import { LIBELLES } from '@/libelles/fr'

const P = LIBELLES.parametresCaisse

/**
 * Seuil de tolérance de caisse (CA2) : une seule ligne de config, même patron que
 * `PageParametresParts` — lecture par défaut, formulaire complet en édition. Ne pilote
 * jamais un blocage : au-delà de ce montant, un motif devient exigé à la fermeture d'une
 * session (voir `PageCaisse`), la fermeture elle-même n'est jamais empêchée.
 */
export function PageParametresCaisse() {
  const client = useQueryClient()
  const [enEdition, setEnEdition] = useState(false)
  const peutGerer = useAPermission('compta.plan.manage')

  const config = useQuery({
    queryKey: ['comptabilite', 'parametres-caisse'],
    queryFn: lireParametresCaisse,
    retry: false,
  })

  const rafraichir = () => {
    setEnEdition(false)
    void client.invalidateQueries({ queryKey: ['comptabilite', 'parametres-caisse'] })
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{P.titre}</h1>
        <p className="text-sm text-muted-foreground">{P.sousTitre}</p>
      </div>

      <Alert>
        <AlertDescription>{P.avertissement}</AlertDescription>
      </Alert>

      {config.isPending ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{P.chargement}</p>
      ) : config.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {config.error instanceof AxiosError && config.error.response?.status === 403
              ? P.interdit
              : config.error instanceof AxiosError && config.error.response?.status === 404
                ? P.nonParametre
                : P.erreur}
          </AlertDescription>
        </Alert>
      ) : enEdition ? (
        <FormulaireEdition
          config={config.data}
          onFini={rafraichir}
          onAnnuler={() => setEnEdition(false)}
        />
      ) : (
        <Lecture config={config.data} peutGerer={peutGerer} onModifier={() => setEnEdition(true)} />
      )}
    </div>
  )
}

function Lecture({
  config,
  peutGerer,
  onModifier,
}: {
  config: ParametresCaisse
  peutGerer: boolean
  onModifier: () => void
}) {
  return (
    <div className="space-y-4 rounded-md border p-4">
      {config.is_provisional && (
        <div title={P.provisoireAide}>
          <Badge ton="warning">{P.provisoire}</Badge>
        </div>
      )}
      <dl>
        <div className="flex items-baseline justify-between gap-4 border-b py-2 last:border-0">
          <dt className="text-sm text-muted-foreground">{P.seuil}</dt>
          <dd className="text-sm font-medium tabular-nums">
            {formatFcfa(config.seuil_tolerance)}
          </dd>
        </div>
      </dl>
      {peutGerer && (
        <Button size="sm" variant="outline" onClick={onModifier}>
          {P.modifier}
        </Button>
      )}
    </div>
  )
}

function FormulaireEdition({
  config,
  onFini,
  onAnnuler,
}: {
  config: ParametresCaisse
  onFini: () => void
  onAnnuler: () => void
}) {
  const [seuil, setSeuil] = useState(String(config.seuil_tolerance))
  const [motif, setMotif] = useState('')

  const seuilValide = /^\d+$/.test(seuil.trim())
  const motifValide = motif.trim().length >= 3
  const valide = seuilValide && motifValide

  const mutation = useMutation({
    mutationFn: () => modifierParametresCaisse(Number(seuil), motif.trim()),
    onSuccess: onFini,
  })

  return (
    <form
      className="space-y-3 rounded-md border bg-brand-subtle/40 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (valide) mutation.mutate()
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="pc-seuil">{P.seuil}</Label>
        <Input
          id="pc-seuil"
          inputMode="numeric"
          value={seuil}
          onChange={(e) => setSeuil(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="pc-motif">{P.motif}</Label>
        <Input
          id="pc-motif"
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder={P.motifPlaceholder}
        />
      </div>

      {mutation.isError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{P.echec}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!valide || mutation.isPending}>
          {mutation.isPending ? P.enregistrementEnCours : P.enregistrer}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onAnnuler}>
          {P.annuler}
        </Button>
      </div>
    </form>
  )
}
