import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  attribuerRole,
  ErreurAction,
  listerRoles,
  retirerRole,
  type EchecAction,
  type Fiche,
} from '@/features/utilisateurs/fiche-api'
import { LIBELLES } from '@/libelles/fr'

const R = LIBELLES.roles

function messageEchec(echec: EchecAction): string {
  switch (echec.type) {
    case 'interdit':
      return LIBELLES.fiche.actionInterdite
    case 'introuvable':
      return LIBELLES.fiche.actionIntrouvable
    case 'conflit':
      return R.dejaAttribue
    case 'reseau':
      return LIBELLES.erreurs.serveurInjoignable
    default:
      return R.erreur
  }
}

/**
 * Section « Rôles » de la fiche.
 *
 * `modifiable` porte la décision de l'appelant (la fiche) : elle vaut vrai si la personne
 * connectée détient roles.assign ET que ce n'est pas sa propre fiche. Ici, on se contente
 * d'afficher soit les contrôles d'édition, soit une explication en lecture seule — la règle
 * de séparation des pouvoirs est décidée en amont, appliquée par le serveur, rappelée ici.
 */
export function SectionRoles({
  fiche,
  modifiable,
  motifLectureSeule,
}: {
  fiche: Fiche
  modifiable: boolean
  motifLectureSeule?: string
}) {
  const queryClient = useQueryClient()
  const [aAjouter, setAAjouter] = useState('')
  const [echec, setEchec] = useState<EchecAction | null>(null)

  // Les rôles disponibles ne sont chargés que si l'on peut éditer (sinon inutile).
  const disponibles = useQuery({
    queryKey: ['roles'],
    queryFn: listerRoles,
    enabled: modifiable,
  })

  const rafraichir = (miseAJour: Fiche) => {
    queryClient.setQueryData(['utilisateur', fiche.id], miseAJour)
    void queryClient.invalidateQueries({ queryKey: ['utilisateurs'] })
    setAAjouter('')
    setEchec(null)
  }
  const surErreur = (erreur: unknown) =>
    setEchec(erreur instanceof ErreurAction ? erreur.echec : { type: 'inattendue' })

  const ajout = useMutation({
    mutationFn: (code: string) => attribuerRole(fiche.id, code),
    onSuccess: rafraichir,
    onError: surErreur,
  })
  const retrait = useMutation({
    mutationFn: (code: string) => retirerRole(fiche.id, code),
    onSuccess: rafraichir,
    onError: surErreur,
  })
  const enCours = ajout.isPending || retrait.isPending

  // Rôles proposables à l'ajout : ceux que la personne n'a pas déjà.
  const dejaDetenus = new Set(fiche.roles.map((r) => r.code))
  const proposables = (disponibles.data ?? []).filter((r) => !dejaDetenus.has(r.code))

  return (
    <section className="space-y-3 rounded-md border p-4">
      <div>
        <h2 className="font-medium">{R.titre}</h2>
        <p className="text-sm text-muted-foreground">{R.sousTitre}</p>
      </div>

      {echec && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{messageEchec(echec)}</AlertDescription>
        </Alert>
      )}

      {fiche.roles.length === 0 ? (
        <p className="text-sm text-muted-foreground">{R.aucun}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {fiche.roles.map((role) => (
            <li
              key={role.code}
              className="flex items-center gap-2 rounded-full border bg-muted/40 py-1 pl-3 pr-1 text-sm"
            >
              <span title={role.code}>{role.name}</span>
              {modifiable && (
                <button
                  type="button"
                  disabled={enCours}
                  onClick={() => retrait.mutate(role.code)}
                  aria-label={`${R.retirer} ${role.name}`}
                  className="rounded-full px-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {modifiable ? (
        <div className="flex items-end gap-2 pt-1">
          <select
            aria-label={R.ajouter}
            value={aAjouter}
            onChange={(e) => setAAjouter(e.target.value)}
            disabled={enCours || disponibles.isPending}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm disabled:opacity-50"
          >
            <option value="">{R.choisir}</option>
            {proposables.map((role) => (
              <option key={role.code} value={role.code}>
                {role.name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            disabled={enCours || !aAjouter}
            onClick={() => ajout.mutate(aAjouter)}
          >
            {R.attribuer}
          </Button>
        </div>
      ) : (
        motifLectureSeule && <p className="text-xs text-muted-foreground">{motifLectureSeule}</p>
      )}
    </section>
  )
}
