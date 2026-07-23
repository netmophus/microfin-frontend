import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useProfil } from '@/features/auth/useProfil'
import {
  ErreurTransition,
  executerTransition,
  type ConditionManquante,
  type EchecTransition,
  type FicheTier,
  type TransitionNom,
} from '@/features/tiers/api'
import { LIBELLES } from '@/libelles/fr'

const A = LIBELLES.tiersActions

/** Métadonnées d'affichage par action : libellé du bouton, textes de confirmation, style. */
interface MetaAction {
  bouton: string
  permission: string
  titre: string
  avertissement: string
  confirmer: string
  danger: boolean
  motif: boolean
}

const META: Record<TransitionNom, MetaAction> = {
  activate: {
    bouton: A.activer,
    permission: 'tiers.validate',
    titre: '',
    avertissement: '',
    confirmer: '',
    danger: false,
    motif: false,
  },
  suspend: {
    bouton: A.suspendre,
    permission: 'tiers.suspend',
    titre: A.suspendreTitre,
    avertissement: A.suspendreAvert,
    confirmer: A.suspendreConfirmer,
    danger: false,
    motif: true,
  },
  reactivate: {
    bouton: A.reactiver,
    permission: 'tiers.suspend',
    titre: A.reactiverTitre,
    avertissement: A.reactiverAvert,
    confirmer: A.reactiverConfirmer,
    danger: false,
    motif: false,
  },
  mark_deceased: {
    bouton: A.marquerDecede,
    permission: 'tiers.suspend',
    titre: A.decedeTitre,
    avertissement: A.decedeAvert,
    confirmer: A.decedeConfirmer,
    danger: false,
    motif: true,
  },
  mark_dissolved: {
    bouton: A.marquerDissous,
    permission: 'tiers.suspend',
    titre: A.dissousTitre,
    avertissement: A.dissousAvert,
    confirmer: A.dissousConfirmer,
    danger: false,
    motif: true,
  },
  deactivate: {
    bouton: A.desactiver,
    permission: 'tiers.deactivate',
    titre: A.desactiverTitre,
    avertissement: A.desactiverAvert,
    confirmer: A.desactiverConfirmer,
    danger: true,
    motif: true,
  },
}

const PRESQUE_TERMINAL = ['prospect', 'actif', 'suspendu_temporaire'] as const

/** Actions POSSIBLES depuis un statut donné — miroir de la machine à états du backend. Le
 *  serveur reste l'autorité (409/403) ; ici on ne PROPOSE simplement pas l'illégal. */
function actionsPossibles(statut: string, type: string): TransitionNom[] {
  const actions: TransitionNom[] = []
  if (statut === 'prospect') actions.push('activate')
  if (statut === 'actif') actions.push('suspend')
  if (statut === 'suspendu_temporaire') actions.push('reactivate')
  if (PRESQUE_TERMINAL.includes(statut as (typeof PRESQUE_TERMINAL)[number])) {
    if (type === 'individual') actions.push('mark_deceased')
    if (type === 'legal_entity' || type === 'group') actions.push('mark_dissolved')
    actions.push('deactivate')
  }
  if (statut === 'suspendu_lcb') actions.push('deactivate')
  return actions
}

function messageEchec(echec: EchecTransition): string {
  if (echec.type === 'illegale') return echec.message
  if (echec.type === 'interdit') return A.interdit
  if (echec.type === 'reseau') return LIBELLES.erreurs.serveurInjoignable
  return A.erreur
}

export function ActionsTier({ tier, onChangement }: { tier: FicheTier; onChangement: () => void }) {
  const profil = useProfil()
  const permissions = profil.data?.permissions ?? []

  const [action, setAction] = useState<TransitionNom | null>(null)
  const [motif, setMotif] = useState('')
  const [conditions, setConditions] = useState<ConditionManquante[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (nom: TransitionNom) => executerTransition(nom, tier.id, motif || null),
    onSuccess: () => {
      fermer()
      onChangement()
    },
    onError: (e) => {
      const echec: EchecTransition = e instanceof ErreurTransition ? e.echec : { type: 'inattendue' }
      if (echec.type === 'conditions') setConditions(echec.conditions)
      else setErreur(messageEchec(echec))
    },
  })

  const possibles = actionsPossibles(tier.status, tier.tier_type).filter((nom) =>
    permissions.includes(META[nom].permission),
  )
  if (possibles.length === 0) return null

  const fermer = () => {
    setAction(null)
    setMotif('')
    setConditions(null)
    setErreur(null)
  }

  const choisir = (nom: TransitionNom) => {
    setMotif('')
    setConditions(null)
    setErreur(null)
    setAction(nom)
    // « Activer » ne se confirme pas : c'est une VÉRIFICATION qui révèle les conditions
    // manquantes. On lance directement, et le 412 remplit la liste ci-dessous.
    if (nom === 'activate') mutation.mutate('activate')
  }

  return (
    <section className="rounded-md border p-4">
      <h2 className="mb-3 text-sm font-semibold">{A.titre}</h2>

      <div className="flex flex-wrap gap-2">
        {possibles.map((nom) => (
          <Button
            key={nom}
            size="sm"
            variant={META[nom].danger ? 'destructive' : 'outline'}
            onClick={() => choisir(nom)}
          >
            {META[nom].bouton}
          </Button>
        ))}
      </div>

      {action === 'activate' && (
        <PanneauActivation
          enCours={mutation.isPending}
          conditions={conditions}
          erreur={erreur}
          onFermer={fermer}
        />
      )}

      {action !== null && action !== 'activate' && (
        <PanneauConfirmation
          meta={META[action]}
          motif={motif}
          setMotif={setMotif}
          erreur={erreur}
          enCours={mutation.isPending}
          onConfirmer={() => mutation.mutate(action)}
          onAnnuler={fermer}
        />
      )}
    </section>
  )
}

/** Confirmation d'une transition, avec motif facultatif. `danger` pour la désactivation. */
function PanneauConfirmation({
  meta,
  motif,
  setMotif,
  erreur,
  enCours,
  onConfirmer,
  onAnnuler,
}: {
  meta: MetaAction
  motif: string
  setMotif: (v: string) => void
  erreur: string | null
  enCours: boolean
  onConfirmer: () => void
  onAnnuler: () => void
}) {
  return (
    <div
      role="alertdialog"
      aria-label={meta.titre}
      className={`mt-3 space-y-3 rounded-lg border-2 p-4 ${
        meta.danger ? 'border-destructive/40 bg-destructive/5' : 'border-amber-300 bg-amber-50'
      }`}
    >
      <h3 className="font-semibold">{meta.titre}</h3>
      <p className="text-sm">{meta.avertissement}</p>

      {meta.motif && (
        <div className="space-y-1.5">
          <Label htmlFor="motif-transition">{A.motif}</Label>
          <textarea
            id="motif-transition"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder={A.motifPlaceholder}
            rows={2}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-xs"
          />
        </div>
      )}

      {erreur && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{erreur}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3">
        <Button
          type="button"
          variant={meta.danger ? 'destructive' : 'default'}
          disabled={enCours}
          onClick={onConfirmer}
        >
          {meta.confirmer}
        </Button>
        <Button type="button" variant="outline" disabled={enCours} onClick={onAnnuler}>
          {A.annuler}
        </Button>
      </div>
    </div>
  )
}

/** Résultat de « Activer » : la LISTE des conditions manquantes (T1e -> toujours au moins le
 *  KYC). C'est ici que se voit la conception « toutes les conditions d'un coup ». */
function PanneauActivation({
  enCours,
  conditions,
  erreur,
  onFermer,
}: {
  enCours: boolean
  conditions: ConditionManquante[] | null
  erreur: string | null
  onFermer: () => void
}) {
  return (
    <div className="mt-3 space-y-3 rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
      {enCours && <p className="text-sm text-muted-foreground">{A.activationEnCours}</p>}

      {conditions && (
        <>
          <h3 className="font-semibold">{A.activationTitre}</h3>
          <p className="text-sm">{A.activationIntro}</p>
          <ul className="list-inside list-disc space-y-1 text-sm">
            {conditions.map((c) => (
              <li key={c.code}>{c.libelle}</li>
            ))}
          </ul>
        </>
      )}

      {erreur && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{erreur}</AlertDescription>
        </Alert>
      )}

      {!enCours && (
        <Button type="button" variant="outline" size="sm" onClick={onFermer}>
          {A.fermer}
        </Button>
      )}
    </div>
  )
}
