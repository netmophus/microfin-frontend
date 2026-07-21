import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { listerAgences } from '@/features/utilisateurs/agences'
import {
  creerUtilisateur,
  ErreurCreation,
  type EchecCreation,
  type UtilisateurCree,
} from '@/features/utilisateurs/api'
import { MotDePasseProvisoire } from '@/features/utilisateurs/MotDePasseProvisoire'
import { schemaCreation, type ChampsCreation } from '@/features/utilisateurs/schema-creation'
import { LIBELLES } from '@/libelles/fr'

const C = LIBELLES.creation

function messageEchec(echec: EchecCreation): string {
  switch (echec.type) {
    case 'conflit':
      return C.conflit
    case 'invalide':
      return C.invalide
    case 'interdit':
      return C.interdit
    case 'reseau':
      return LIBELLES.erreurs.serveurInjoignable
    default:
      return LIBELLES.erreurs.inattendue
  }
}

export function PageCreationUtilisateur() {
  const naviguer = useNavigate()
  const queryClient = useQueryClient()
  const [echec, setEchec] = useState<EchecCreation | null>(null)
  // Une fois le compte créé, on passe à l'écran du mot de passe : cet état porte le résultat.
  const [cree, setCree] = useState<UtilisateurCree | null>(null)

  const agences = useQuery({ queryKey: ['agences'], queryFn: listerAgences })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChampsCreation>({
    resolver: zodResolver(schemaCreation),
    defaultValues: {
      matricule: '',
      last_name: '',
      first_name: '',
      username: '',
      email: '',
      phone: '',
      primary_agency_id: '',
    },
  })

  const mutation = useMutation({
    mutationFn: (champs: ChampsCreation) =>
      creerUtilisateur({
        matricule: champs.matricule,
        last_name: champs.last_name,
        first_name: champs.first_name,
        username: champs.username,
        email: champs.email,
        phone: champs.phone?.trim() ? champs.phone.trim() : null,
        primary_agency_id: champs.primary_agency_id,
      }),
    onSuccess: (resultat) => {
      // Le nouvel utilisateur doit apparaître dans la liste au retour : on invalide son cache.
      void queryClient.invalidateQueries({ queryKey: ['utilisateurs'] })
      setCree(resultat)
    },
    onError: (erreur) => {
      setEchec(erreur instanceof ErreurCreation ? erreur.echec : { type: 'inattendue' })
    },
  })

  const soumettre = handleSubmit((champs) => {
    setEchec(null)
    mutation.mutate(champs)
  })

  // ÉTAT 2 : compte créé — on montre le mot de passe, seul chemin pour continuer.
  if (cree) {
    const nom = `${cree.utilisateur.first_name} ${cree.utilisateur.last_name}`.trim()
    return (
      <MotDePasseProvisoire
        nom={nom || cree.utilisateur.username}
        motDePasse={cree.motDePasseProvisoire}
        onTermine={() => void naviguer('/utilisateurs', { replace: true })}
      />
    )
  }

  // ÉTAT 1 : formulaire de saisie.
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{C.titre}</h1>
        <p className="text-sm text-muted-foreground">{C.instruction}</p>
      </div>

      {echec && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{messageEchec(echec)}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={(e) => void soumettre(e)} noValidate className="space-y-4">
        <Champ id="matricule" label={C.matricule} erreur={errors.matricule?.message}>
          <Input id="matricule" autoFocus {...register('matricule')} />
        </Champ>

        <div className="grid grid-cols-2 gap-3">
          <Champ id="last_name" label={C.nom} erreur={errors.last_name?.message}>
            <Input id="last_name" {...register('last_name')} />
          </Champ>
          <Champ id="first_name" label={C.prenom} erreur={errors.first_name?.message}>
            <Input id="first_name" {...register('first_name')} />
          </Champ>
        </div>

        <Champ id="username" label={C.identifiant} erreur={errors.username?.message}>
          <Input id="username" autoComplete="off" {...register('username')} />
        </Champ>

        <Champ id="email" label={C.email} erreur={errors.email?.message}>
          <Input id="email" type="email" {...register('email')} />
        </Champ>

        <Champ id="phone" label={C.telephoneFacultatif} erreur={errors.phone?.message}>
          <Input id="phone" type="tel" {...register('phone')} />
        </Champ>

        <Champ id="primary_agency_id" label={C.agence} erreur={errors.primary_agency_id?.message}>
          <select
            id="primary_agency_id"
            {...register('primary_agency_id')}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs disabled:opacity-50"
            disabled={agences.isPending || agences.isError}
          >
            <option value="">{C.agenceChoisir}</option>
            {agences.data?.map((agence) => (
              <option key={agence.id} value={agence.id}>
                {agence.name}
              </option>
            ))}
          </select>
          {agences.isError && (
            <p className="text-sm text-destructive">{C.agencesIndisponibles}</p>
          )}
        </Champ>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? C.creationEnCours : C.creer}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void naviguer('/utilisateurs', { replace: true })}
          >
            {C.annuler}
          </Button>
        </div>
      </form>
    </div>
  )
}

/** Ligne de formulaire : label + champ + message d'erreur, pour ne pas répéter la structure. */
function Champ({
  id,
  label,
  erreur,
  children,
}: {
  id: string
  label: string
  erreur?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {erreur && <p className="text-sm text-destructive">{erreur}</p>}
    </div>
  )
}
