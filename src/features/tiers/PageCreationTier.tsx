import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAPermission } from '@/features/auth/useProfil'
import type { FicheTier } from '@/features/tiers/api'
import {
  FormGroupement,
  FormIndividu,
  FormPersonneMorale,
  type FormProps,
} from '@/features/tiers/formulaires-tier'
import { listerAgences } from '@/features/utilisateurs/agences'
import { LIBELLES } from '@/libelles/fr'

const T = LIBELLES.tiersCreation

type TypeTier = 'individual' | 'legal_entity' | 'group'

const CHOIX: { type: TypeTier; libelle: string; aide: string }[] = [
  { type: 'individual', libelle: T.typePhysique, aide: T.typePhysiqueAide },
  { type: 'legal_entity', libelle: T.typeMorale, aide: T.typeMoraleAide },
  { type: 'group', libelle: T.typeGroupement, aide: T.typeGroupementAide },
]

export function PageCreationTier() {
  const naviguer = useNavigate()
  const queryClient = useQueryClient()
  const [type, setType] = useState<TypeTier>('individual')

  // Portée réseau -> sélecteur d'agence. Un utilisateur cloisonné crée dans SON agence
  // (le backend la dérive du claim), il n'a pas de choix à faire.
  const reseau = useAPermission('perimetre.reseau')
  const agences = useQuery({ queryKey: ['agences'], queryFn: listerAgences, enabled: reseau })

  const onCree = (fiche: FicheTier) => {
    // La nouvelle fiche doit apparaître dans la liste, et on va droit à sa fiche.
    void queryClient.invalidateQueries({ queryKey: ['tiers'] })
    void naviguer(`/tiers/${fiche.id}`, { replace: true })
  }
  const onAnnuler = () => void naviguer('/tiers', { replace: true })

  // Le type est HORS des formulaires. Chaque type monte un composant DIFFÉRENT : changer de
  // type démonte le formulaire précédent et ses valeurs — pas de RCCM resté d'un autre type.
  const props: FormProps = { agences: agences.data, reseau, onCree, onAnnuler }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{T.titre}</h1>
        <p className="text-sm text-muted-foreground">{T.instruction}</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{T.typeQuestion}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {CHOIX.map((choix) => (
            <label
              key={choix.type}
              className={`cursor-pointer rounded-md border p-3 text-sm ${
                type === choix.type
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'hover:bg-muted/30'
              }`}
            >
              <input
                type="radio"
                name="type-tier"
                value={choix.type}
                checked={type === choix.type}
                onChange={() => setType(choix.type)}
                className="sr-only"
              />
              <span className="block font-medium">{choix.libelle}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{choix.aide}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {type === 'individual' && <FormIndividu {...props} />}
      {type === 'legal_entity' && <FormPersonneMorale {...props} />}
      {type === 'group' && <FormGroupement {...props} />}
    </div>
  )
}
