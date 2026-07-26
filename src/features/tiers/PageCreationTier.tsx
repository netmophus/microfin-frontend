import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, UserRound, Users, type LucideIcon } from 'lucide-react'
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

const CHOIX: { type: TypeTier; libelle: string; aide: string; icone: LucideIcon }[] = [
  { type: 'individual', libelle: T.typePhysique, aide: T.typePhysiqueAide, icone: UserRound },
  { type: 'legal_entity', libelle: T.typeMorale, aide: T.typeMoraleAide, icone: Building2 },
  { type: 'group', libelle: T.typeGroupement, aide: T.typeGroupementAide, icone: Users },
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
          {CHOIX.map((choix) => {
            const actif = type === choix.type
            const Icone = choix.icone
            return (
              <label
                key={choix.type}
                className={`cursor-pointer rounded-lg border-2 p-3 text-sm transition-colors ${
                  actif
                    ? 'border-primary bg-brand-subtle'
                    : 'border-border hover:border-primary/40 hover:bg-muted/30'
                }`}
              >
                <input
                  type="radio"
                  name="type-tier"
                  value={choix.type}
                  checked={actif}
                  onChange={() => setType(choix.type)}
                  className="sr-only"
                />
                <Icone className={`mb-1.5 size-5 ${actif ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={`block font-medium ${actif ? 'text-primary' : ''}`}>
                  {choix.libelle}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{choix.aide}</span>
              </label>
            )
          })}
        </div>
      </fieldset>

      {type === 'individual' && <FormIndividu {...props} />}
      {type === 'legal_entity' && <FormPersonneMorale {...props} />}
      {type === 'group' && <FormGroupement {...props} />}
    </div>
  )
}
