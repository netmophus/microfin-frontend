import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import {
  useForm,
  type FieldErrors,
  type FieldValues,
  type Path,
  type UseFormRegister,
} from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  creerGroupement,
  creerIndividu,
  creerPersonneMorale,
  ErreurCreation,
  type EchecCreation,
  type FicheTier,
} from '@/features/tiers/api'
import { listerDevises, listerPays } from '@/features/tiers/referentiels'
import {
  schemaGroupement,
  schemaIndividu,
  schemaPersonneMorale,
  type ChampsGroupement,
  type ChampsIndividu,
  type ChampsPersonneMorale,
} from '@/features/tiers/schemas'
import type { Agence } from '@/features/utilisateurs/agences'
import { LIBELLES } from '@/libelles/fr'

const T = LIBELLES.tiersCreation
const SELECT =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs disabled:opacity-50'

export interface FormProps {
  agences: Agence[] | undefined
  reseau: boolean
  onCree: (fiche: FicheTier) => void
  onAnnuler: () => void
}

function messageEchec(echec: EchecCreation): string {
  switch (echec.type) {
    case 'conflit':
      return T.conflit
    case 'reference':
      return T.reference
    case 'invalide':
      return T.invalide
    case 'interdit':
      return T.interdit
    case 'reseau':
      return LIBELLES.erreurs.serveurInjoignable
    default:
      return LIBELLES.erreurs.inattendue
  }
}

/** Ligne de formulaire : label + champ + erreur. */
function Champ({
  id,
  label,
  erreur,
  children,
}: {
  id: string
  label: string
  erreur?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {erreur && <p className="text-sm text-destructive">{erreur}</p>}
    </div>
  )
}

/**
 * Champs communs à tout tiers. Générique sur le type du formulaire : les trois schémas
 * partagent primary_phone et primary_agency_id. Le sélecteur d'agence n'apparaît que pour une
 * portée réseau — un utilisateur cloisonné crée dans SON agence (dérivée du claim côté backend),
 * il n'a rien à choisir.
 */
function ChampsCommuns<T extends FieldValues>({
  register,
  errors,
  reseau,
  agences,
}: {
  register: UseFormRegister<T>
  errors: FieldErrors<T>
  reseau: boolean
  agences: Agence[] | undefined
}) {
  const err = errors as FieldErrors
  const errPhone = err.primary_phone?.message as string | undefined
  const errAgence = err.primary_agency_id?.message as string | undefined
  return (
    <>
      <Champ id="primary_phone" label={LIBELLES.tiersCreation.telephone} erreur={errPhone}>
        <Input id="primary_phone" type="tel" {...register('primary_phone' as Path<T>)} />
      </Champ>
      {reseau && (
        <Champ id="primary_agency_id" label={LIBELLES.tiersCreation.agence} erreur={errAgence}>
          <select id="primary_agency_id" className={SELECT} {...register('primary_agency_id' as Path<T>)}>
            <option value="">{LIBELLES.tiersCreation.agenceChoisir}</option>
            {agences?.map((agence) => (
              <option key={agence.id} value={agence.id}>
                {agence.name}
              </option>
            ))}
          </select>
        </Champ>
      )}
    </>
  )
}

function Boutons({ enCours, onAnnuler }: { enCours: boolean; onAnnuler: () => void }) {
  return (
    <div className="flex gap-3 pt-2">
      <Button type="submit" disabled={enCours}>
        {enCours ? T.creationEnCours : T.creer}
      </Button>
      <Button type="button" variant="outline" onClick={onAnnuler}>
        {T.annuler}
      </Button>
    </div>
  )
}

// --- Personne physique -----------------------------------------------------------------

export function FormIndividu({ agences, reseau, onCree, onAnnuler }: FormProps) {
  const [echec, setEchec] = useState<EchecCreation | null>(null)
  const pays = useQuery({ queryKey: ['pays'], queryFn: listerPays })
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChampsIndividu>({
    resolver: zodResolver(schemaIndividu),
    defaultValues: {
      last_name: '',
      first_name: '',
      birth_date: '',
      gender: '',
      nationality_id: '',
      profession: '',
      primary_phone: '',
      primary_agency_id: '',
    },
  })

  const mutation = useMutation({
    mutationFn: (c: ChampsIndividu) =>
      creerIndividu({
        last_name: c.last_name,
        first_name: c.first_name,
        birth_date: c.birth_date,
        gender: c.gender,
        nationality_id: c.nationality_id,
        profession: c.profession?.trim() || null,
        primary_phone: c.primary_phone?.trim() || null,
        primary_agency_id: c.primary_agency_id?.trim() || null,
      }),
    onSuccess: onCree,
    onError: (e) => setEchec(e instanceof ErreurCreation ? e.echec : { type: 'inattendue' }),
  })

  const soumettre = handleSubmit((c) => {
    setEchec(null)
    mutation.mutate(c)
  })

  return (
    <form onSubmit={(e) => void soumettre(e)} noValidate className="space-y-4">
      {echec && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{messageEchec(echec)}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Champ id="last_name" label={T.nom} erreur={errors.last_name?.message}>
          <Input id="last_name" autoFocus {...register('last_name')} />
        </Champ>
        <Champ id="first_name" label={T.prenom} erreur={errors.first_name?.message}>
          <Input id="first_name" {...register('first_name')} />
        </Champ>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Champ id="birth_date" label={T.dateNaissance} erreur={errors.birth_date?.message}>
          <Input id="birth_date" type="date" {...register('birth_date')} />
        </Champ>
        <Champ id="gender" label={T.sexe} erreur={errors.gender?.message}>
          <select id="gender" className={SELECT} {...register('gender')}>
            <option value="">{T.sexeChoisir}</option>
            <option value="M">{T.sexeM}</option>
            <option value="F">{T.sexeF}</option>
          </select>
        </Champ>
      </div>

      <Champ id="nationality_id" label={T.nationalite} erreur={errors.nationality_id?.message}>
        <select
          id="nationality_id"
          className={SELECT}
          disabled={pays.isPending || pays.isError}
          {...register('nationality_id')}
        >
          <option value="">{T.nationaliteChoisir}</option>
          {pays.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {pays.isError && <p className="text-sm text-destructive">{T.paysIndisponibles}</p>}
      </Champ>

      <Champ id="profession" label={T.profession} erreur={errors.profession?.message}>
        <Input id="profession" {...register('profession')} />
      </Champ>

      <ChampsCommuns register={register} errors={errors} reseau={reseau} agences={agences} />
      <Boutons enCours={mutation.isPending} onAnnuler={onAnnuler} />
    </form>
  )
}

// --- Personne morale -------------------------------------------------------------------

export function FormPersonneMorale({ agences, reseau, onCree, onAnnuler }: FormProps) {
  const [echec, setEchec] = useState<EchecCreation | null>(null)
  const pays = useQuery({ queryKey: ['pays'], queryFn: listerPays })
  const devises = useQuery({ queryKey: ['devises'], queryFn: listerDevises })
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChampsPersonneMorale>({
    resolver: zodResolver(schemaPersonneMorale),
    defaultValues: {
      legal_name: '',
      legal_form: '',
      constitution_date: '',
      headquarters_country_id: '',
      capital_amount: '',
      capital_currency_id: '',
      primary_phone: '',
      primary_agency_id: '',
    },
  })

  const mutation = useMutation({
    mutationFn: (c: ChampsPersonneMorale) =>
      creerPersonneMorale({
        legal_name: c.legal_name,
        legal_form: c.legal_form,
        constitution_date: c.constitution_date,
        headquarters_country_id: c.headquarters_country_id,
        capital_amount: c.capital_amount?.trim() || null,
        capital_currency_id: c.capital_currency_id?.trim() || null,
        primary_phone: c.primary_phone?.trim() || null,
        primary_agency_id: c.primary_agency_id?.trim() || null,
      }),
    onSuccess: onCree,
    onError: (e) => setEchec(e instanceof ErreurCreation ? e.echec : { type: 'inattendue' }),
  })

  const soumettre = handleSubmit((c) => {
    setEchec(null)
    mutation.mutate(c)
  })

  return (
    <form onSubmit={(e) => void soumettre(e)} noValidate className="space-y-4">
      {echec && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{messageEchec(echec)}</AlertDescription>
        </Alert>
      )}

      <Champ id="legal_name" label={T.raisonSociale} erreur={errors.legal_name?.message}>
        <Input id="legal_name" autoFocus {...register('legal_name')} />
      </Champ>

      <div className="grid grid-cols-2 gap-3">
        <Champ id="legal_form" label={T.formeJuridique} erreur={errors.legal_form?.message}>
          <select id="legal_form" className={SELECT} {...register('legal_form')}>
            <option value="">{T.formeChoisir}</option>
            {Object.entries(T.formesJuridiques).map(([code, libelle]) => (
              <option key={code} value={code}>
                {libelle}
              </option>
            ))}
          </select>
        </Champ>
        <Champ
          id="constitution_date"
          label={T.dateConstitution}
          erreur={errors.constitution_date?.message}
        >
          <Input id="constitution_date" type="date" {...register('constitution_date')} />
        </Champ>
      </div>

      <Champ id="headquarters_country_id" label={T.siege} erreur={errors.headquarters_country_id?.message}>
        <select
          id="headquarters_country_id"
          className={SELECT}
          disabled={pays.isPending || pays.isError}
          {...register('headquarters_country_id')}
        >
          <option value="">{T.nationaliteChoisir}</option>
          {pays.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {pays.isError && <p className="text-sm text-destructive">{T.paysIndisponibles}</p>}
      </Champ>

      <div className="grid grid-cols-2 gap-3">
        <Champ id="capital_amount" label={T.capital} erreur={errors.capital_amount?.message}>
          <Input id="capital_amount" type="number" step="1" min="0" {...register('capital_amount')} />
        </Champ>
        <Champ id="capital_currency_id" label={T.devise} erreur={errors.capital_currency_id?.message}>
          <select
            id="capital_currency_id"
            className={SELECT}
            disabled={devises.isPending || devises.isError}
            {...register('capital_currency_id')}
          >
            <option value="">{T.deviseChoisir}</option>
            {devises.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code}
              </option>
            ))}
          </select>
        </Champ>
      </div>

      <ChampsCommuns register={register} errors={errors} reseau={reseau} agences={agences} />
      <Boutons enCours={mutation.isPending} onAnnuler={onAnnuler} />
    </form>
  )
}

// --- Groupement ------------------------------------------------------------------------

export function FormGroupement({ agences, reseau, onCree, onAnnuler }: FormProps) {
  const [echec, setEchec] = useState<EchecCreation | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChampsGroupement>({
    resolver: zodResolver(schemaGroupement),
    defaultValues: {
      group_name: '',
      group_type: '',
      constitution_date: '',
      primary_phone: '',
      primary_agency_id: '',
    },
  })

  const mutation = useMutation({
    mutationFn: (c: ChampsGroupement) =>
      creerGroupement({
        group_name: c.group_name,
        group_type: c.group_type,
        constitution_date: c.constitution_date,
        primary_phone: c.primary_phone?.trim() || null,
        primary_agency_id: c.primary_agency_id?.trim() || null,
      }),
    onSuccess: onCree,
    onError: (e) => setEchec(e instanceof ErreurCreation ? e.echec : { type: 'inattendue' }),
  })

  const soumettre = handleSubmit((c) => {
    setEchec(null)
    mutation.mutate(c)
  })

  return (
    <form onSubmit={(e) => void soumettre(e)} noValidate className="space-y-4">
      {echec && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{messageEchec(echec)}</AlertDescription>
        </Alert>
      )}

      <Champ id="group_name" label={T.nomGroupement} erreur={errors.group_name?.message}>
        <Input id="group_name" autoFocus {...register('group_name')} />
      </Champ>

      <div className="grid grid-cols-2 gap-3">
        <Champ id="group_type" label={T.typeGroupementLabel} erreur={errors.group_type?.message}>
          <select id="group_type" className={SELECT} {...register('group_type')}>
            <option value="">{T.typeGroupementChoisir}</option>
            {Object.entries(T.typesGroupement).map(([code, libelle]) => (
              <option key={code} value={code}>
                {libelle}
              </option>
            ))}
          </select>
        </Champ>
        <Champ
          id="constitution_date"
          label={T.dateConstitution}
          erreur={errors.constitution_date?.message}
        >
          <Input id="constitution_date" type="date" {...register('constitution_date')} />
        </Champ>
      </div>

      <ChampsCommuns register={register} errors={errors} reseau={reseau} agences={agences} />
      <Boutons enCours={mutation.isPending} onAnnuler={onAnnuler} />
    </form>
  )
}
