import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Fiche, Modifications } from '@/features/utilisateurs/fiche-api'
import {
  schemaModification,
  type ChampsModification,
} from '@/features/utilisateurs/schema-modification'
import { LIBELLES } from '@/libelles/fr'

const M = LIBELLES.modification

/**
 * Formulaire de modification d'une fiche. Pré-rempli avec les valeurs actuelles ; ne touche
 * que nom, prénom, adresse et téléphone.
 */
export function FormulaireModification({
  fiche,
  enCours,
  onEnregistrer,
  onAnnuler,
}: {
  fiche: Fiche
  enCours: boolean
  onEnregistrer: (modifications: Modifications) => void
  onAnnuler: () => void
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChampsModification>({
    resolver: zodResolver(schemaModification),
    defaultValues: {
      last_name: fiche.last_name,
      first_name: fiche.first_name,
      email: fiche.email,
      phone: fiche.phone ?? '',
    },
  })

  const soumettre = handleSubmit((champs) =>
    onEnregistrer({
      last_name: champs.last_name,
      first_name: champs.first_name,
      email: champs.email,
      phone: champs.phone?.trim() ? champs.phone.trim() : null,
    }),
  )

  return (
    <form onSubmit={(e) => void soumettre(e)} noValidate className="max-w-lg space-y-4">
      <h2 className="text-lg font-medium">{M.titre}</h2>
      <p className="text-sm text-muted-foreground">{M.identifiantsFixes}</p>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="last_name">{M.nom}</Label>
          <Input id="last_name" autoFocus {...register('last_name')} />
          {errors.last_name && (
            <p className="text-sm text-destructive">{errors.last_name.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="first_name">{M.prenom}</Label>
          <Input id="first_name" {...register('first_name')} />
          {errors.first_name && (
            <p className="text-sm text-destructive">{errors.first_name.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">{M.email}</Label>
        <Input id="email" type="email" {...register('email')} />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">{M.telephone}</Label>
        <Input id="phone" type="tel" {...register('phone')} />
        {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
      </div>

      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={enCours}>
          {enCours ? M.enregistrementEnCours : M.enregistrer}
        </Button>
        <Button type="button" variant="outline" disabled={enCours} onClick={onAnnuler}>
          {M.annuler}
        </Button>
      </div>
    </form>
  )
}
