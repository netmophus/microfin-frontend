import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { ArrowLeft } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAPermission } from '@/features/auth/useProfil'
import {
  changerSens,
  desactiverCompte,
  lireCompte,
  messageRefusCompte,
  modifierCompte,
  type CompteDetail,
} from '@/features/comptabilite/api'
import { LIBELLES } from '@/libelles/fr'

const P = LIBELLES.planComptable

type Vue = { mode: 'fiche' } | { mode: 'modifier' } | { mode: 'sens' } | { mode: 'desactiver' }

/**
 * Fiche d'un compte du plan — modifier le libellé (partiel), changer le sens, désactiver. Les
 * deux derniers actes sont SENSIBLES : motif obligatoire, tracés (audit avant/après). Les
 * garde-fous (compte système, mouvementé, enfants actifs) sont affichés tels quels — le
 * serveur reste l'autorité, l'écran ne fait qu'offrir ou masquer les boutons en conséquence.
 */
export function PageFicheCompte() {
  const { id = '' } = useParams()
  const client = useQueryClient()
  const [vue, setVue] = useState<Vue>({ mode: 'fiche' })
  const peutGerer = useAPermission('compta.plan.manage')

  const requete = useQuery({
    queryKey: ['comptabilite', 'compte', id],
    queryFn: () => lireCompte(id),
  })

  const rafraichir = (compte: CompteDetail) => {
    client.setQueryData(['comptabilite', 'compte', id], compte)
    void client.invalidateQueries({ queryKey: ['comptabilite', 'comptes'] })
    setVue({ mode: 'fiche' })
  }

  if (requete.isPending) {
    return <p className="py-8 text-sm text-muted-foreground">{P.chargement}</p>
  }
  if (requete.isError) {
    const introuvable = requete.error instanceof AxiosError && requete.error.response?.status === 404
    return (
      <div className="space-y-4">
        <RetourListe />
        <Alert variant="destructive" role="alert">
          <AlertDescription>{introuvable ? P.introuvable : P.erreur}</AlertDescription>
        </Alert>
      </div>
    )
  }

  const compte = requete.data

  return (
    <div className="max-w-2xl space-y-5">
      <RetourListe />

      <header className="flex items-center gap-4 rounded-lg border bg-card p-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-tight">{compte.name}</h1>
          <p className="font-mono text-sm text-muted-foreground">{compte.account_number}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Badge ton={compte.is_active ? 'success' : 'neutral'}>
            {compte.is_active ? P.actif : P.inactif}
          </Badge>
          {compte.is_provisional && (
            <span title={P.provisoireAide}>
              <Badge ton="warning">{P.provisoire}</Badge>
            </span>
          )}
        </div>
      </header>

      {vue.mode === 'modifier' ? (
        <FormulaireModification
          compte={compte}
          onEnregistre={rafraichir}
          onAnnuler={() => setVue({ mode: 'fiche' })}
        />
      ) : (
        <>
          <Details compte={compte} />

          {vue.mode === 'sens' && (
            <PanneauSens
              compte={compte}
              onEnregistre={rafraichir}
              onAnnuler={() => setVue({ mode: 'fiche' })}
            />
          )}
          {vue.mode === 'desactiver' && (
            <PanneauDesactivation
              compte={compte}
              onEnregistre={rafraichir}
              onAnnuler={() => setVue({ mode: 'fiche' })}
            />
          )}

          {vue.mode === 'fiche' && peutGerer && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setVue({ mode: 'modifier' })}>
                {P.modifier}
              </Button>
              {!compte.is_system && (
                <Button variant="outline" size="sm" onClick={() => setVue({ mode: 'sens' })}>
                  {P.changerSens}
                </Button>
              )}
              {compte.is_active && (
                <Button variant="destructive" size="sm" onClick={() => setVue({ mode: 'desactiver' })}>
                  {P.desactiver}
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function RetourListe() {
  return (
    <Link
      to="/comptabilite/plan"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {P.retour}
    </Link>
  )
}

function Ligne({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-2 py-1.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}

function Details({ compte }: { compte: CompteDetail }) {
  return (
    <dl className="divide-y rounded-md border px-4 py-1">
      <Ligne label={P.colonneClasse}>{compte.account_class}</Ligne>
      <Ligne label={P.colonneSens}>{P.sens[compte.normal_side] ?? compte.normal_side}</Ligne>
      <Ligne label={P.colonneNature}>
        {compte.is_posting ? P.nature.posting : P.nature.regroupement}
      </Ligne>
      {compte.parent_number && <Ligne label="Parent">{compte.parent_number}</Ligne>}
      {compte.short_name && <Ligne label={P.creationLibelleCourt}>{compte.short_name}</Ligne>}
      {compte.notes && <Ligne label={P.modifierNotes}>{compte.notes}</Ligne>}
    </dl>
  )
}

function FormulaireModification({
  compte,
  onEnregistre,
  onAnnuler,
}: {
  compte: CompteDetail
  onEnregistre: (c: CompteDetail) => void
  onAnnuler: () => void
}) {
  const [name, setName] = useState(compte.name)
  const [shortName, setShortName] = useState(compte.short_name ?? '')
  const [notes, setNotes] = useState(compte.notes ?? '')

  const mutation = useMutation({
    mutationFn: () =>
      modifierCompte(compte.id, { name: name.trim(), short_name: shortName.trim() || null, notes: notes.trim() || null }),
    onSuccess: onEnregistre,
  })

  return (
    <form
      className="space-y-3 rounded-md border p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (name.trim()) mutation.mutate()
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="fc-name">{P.creationLibelle}</Label>
        <Input id="fc-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="fc-short">{P.creationLibelleCourt}</Label>
        <Input id="fc-short" value={shortName} onChange={(e) => setShortName(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="fc-notes">{P.modifierNotes}</Label>
        <Input id="fc-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {mutation.isError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{messageRefusCompte(mutation.error, P.modificationEchec)}</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!name.trim() || mutation.isPending}>
          {mutation.isPending ? P.enregistrementEnCours : P.enregistrer}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onAnnuler}>
          {P.annuler}
        </Button>
      </div>
    </form>
  )
}

function PanneauSens({
  compte,
  onEnregistre,
  onAnnuler,
}: {
  compte: CompteDetail
  onEnregistre: (c: CompteDetail) => void
  onAnnuler: () => void
}) {
  const [sens, setSens] = useState<'D' | 'C'>(compte.normal_side === 'D' ? 'C' : 'D')
  const [motif, setMotif] = useState('')

  const mutation = useMutation({
    mutationFn: () => changerSens(compte.id, sens, motif.trim()),
    onSuccess: onEnregistre,
  })

  const motifValide = motif.trim().length >= 3

  return (
    <form
      className="space-y-3 rounded-md border border-warning/40 bg-warning-subtle/40 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (motifValide) mutation.mutate()
      }}
    >
      <p className="text-sm font-medium">{P.changerSensTitre}</p>
      <p className="text-sm text-muted-foreground">{P.changerSensAide}</p>

      <div className="space-y-1">
        <Label htmlFor="ps-sens">{P.nouveauSens}</Label>
        <select
          id="ps-sens"
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          value={sens}
          onChange={(e) => setSens(e.target.value as 'D' | 'C')}
        >
          <option value="D">{P.sens.D}</option>
          <option value="C">{P.sens.C}</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="ps-motif">{P.motif}</Label>
        <Input
          id="ps-motif"
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder={P.motifPlaceholder}
        />
        {motif.length > 0 && !motifValide && (
          <p className="text-xs text-destructive">{P.motifRequis}</p>
        )}
      </div>

      {mutation.isError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{messageRefusCompte(mutation.error, P.changerSensEchec)}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!motifValide || mutation.isPending}>
          {mutation.isPending ? P.changementEnCours : P.confirmer}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onAnnuler}>
          {P.annuler}
        </Button>
      </div>
    </form>
  )
}

function PanneauDesactivation({
  compte,
  onEnregistre,
  onAnnuler,
}: {
  compte: CompteDetail
  onEnregistre: (c: CompteDetail) => void
  onAnnuler: () => void
}) {
  const [motif, setMotif] = useState('')

  const mutation = useMutation({
    mutationFn: () => desactiverCompte(compte.id, motif.trim()),
    onSuccess: onEnregistre,
  })

  const motifValide = motif.trim().length >= 3

  return (
    <form
      className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (motifValide) mutation.mutate()
      }}
    >
      <p className="text-sm font-medium">{P.desactiverTitre}</p>
      <p className="text-sm text-muted-foreground">{P.desactiverAide}</p>

      <div className="space-y-1">
        <Label htmlFor="pd-motif">{P.motif}</Label>
        <Input
          id="pd-motif"
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder={P.motifPlaceholder}
        />
        {motif.length > 0 && !motifValide && (
          <p className="text-xs text-destructive">{P.motifRequis}</p>
        )}
      </div>

      {mutation.isError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{messageRefusCompte(mutation.error, P.desactivationEchec)}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button type="submit" variant="destructive" size="sm" disabled={!motifValide || mutation.isPending}>
          {mutation.isPending ? P.changementEnCours : P.desactiverConfirmer}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onAnnuler}>
          {P.annuler}
        </Button>
      </div>
    </form>
  )
}
