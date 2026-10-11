import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ErreurModification,
  modifierGroupement,
  modifierPersonneMorale,
  type FicheTier,
} from '@/features/tiers/api'
import { listerDevises, listerPays } from '@/features/tiers/referentiels'
import {
  schemaEditionGroupement,
  schemaEditionPersonneMorale,
  type ChampsEditionGroupement,
  type ChampsEditionPersonneMorale,
} from '@/features/tiers/schemas'
import { LIBELLES } from '@/libelles/fr'

const T = LIBELLES.tiersCreation
const F = LIBELLES.tiersFiche
const SELECT =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs disabled:opacity-50'

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

function Boutons({ enCours, onAnnuler }: { enCours: boolean; onAnnuler: () => void }) {
  return (
    <div className="flex gap-3 pt-2">
      <Button type="submit" disabled={enCours}>
        {enCours ? F.enregistrementEnCours : F.enregistrerModifications}
      </Button>
      <Button type="button" variant="outline" onClick={onAnnuler}>
        {F.annulerModification}
      </Button>
    </div>
  )
}

function Echec({ message }: { message: string | null }) {
  if (message === null) return null
  return (
    <Alert variant="destructive" role="alert">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

/** Édition du profil d'une personne morale ou d'un groupement : les champs de la création, plus
 *  ceux qu'elle ne demande pas (nom commercial, RCCM, NIF, objet…). Le serveur n'écrit que ce qui
 *  change, trace l'ancienne et la nouvelle valeur, et refuse un RCCM ou un NIF déjà porté par une
 *  autre fiche (son message est affiché tel quel). */
export function EditionProfil({ fiche, onTermine }: { fiche: FicheTier; onTermine: () => void }) {
  if (fiche.personne_morale) {
    return <EditionPersonneMorale fiche={fiche} detail={fiche.personne_morale} onTermine={onTermine} />
  }
  if (fiche.groupement) {
    return <EditionGroupement fiche={fiche} detail={fiche.groupement} onTermine={onTermine} />
  }
  return null
}

function EditionPersonneMorale({
  fiche,
  detail,
  onTermine,
}: {
  fiche: FicheTier
  detail: NonNullable<FicheTier['personne_morale']>
  onTermine: () => void
}) {
  const queryClient = useQueryClient()
  const [echec, setEchec] = useState<string | null>(null)
  const pays = useQuery({ queryKey: ['pays'], queryFn: listerPays })
  const devises = useQuery({ queryKey: ['devises'], queryFn: listerDevises })
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChampsEditionPersonneMorale>({
    resolver: zodResolver(schemaEditionPersonneMorale),
    defaultValues: {
      legal_name: detail.legal_name,
      commercial_name: detail.commercial_name ?? '',
      legal_form: detail.legal_form,
      rccm_number: detail.rccm_number ?? '',
      nif_number: detail.nif_number ?? '',
      constitution_date: detail.constitution_date,
      capital_amount: detail.capital_amount ?? '',
      capital_currency_id: detail.capital_currency_id ?? '',
      business_purpose: detail.business_purpose ?? '',
      headquarters_country_id: detail.headquarters_country_id,
    },
  })

  const mutation = useMutation({
    mutationFn: (c: ChampsEditionPersonneMorale) =>
      modifierPersonneMorale(fiche.id, {
        legal_name: c.legal_name,
        commercial_name: c.commercial_name || null,
        legal_form: c.legal_form,
        rccm_number: c.rccm_number || null,
        nif_number: c.nif_number || null,
        constitution_date: c.constitution_date,
        capital_amount: c.capital_amount || null,
        capital_currency_id: c.capital_currency_id || null,
        business_purpose: c.business_purpose || null,
        headquarters_country_id: c.headquarters_country_id,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tiers'] })
      onTermine()
    },
    onError: (e) => setEchec(e instanceof ErreurModification && e.detail ? e.detail : F.erreurModification),
  })

  const soumettre = handleSubmit((c) => {
    setEchec(null)
    mutation.mutate(c)
  })

  return (
    <form onSubmit={(e) => void soumettre(e)} noValidate className="space-y-4" aria-label={F.modifierTitre}>
      <Echec message={echec} />
      <Champ id="legal_name" label={T.raisonSociale} erreur={errors.legal_name?.message}>
        <Input id="legal_name" autoFocus {...register('legal_name')} />
      </Champ>
      <Champ
        id="commercial_name"
        label={`${F.nomCommercial} (facultatif)`}
        erreur={errors.commercial_name?.message}
      >
        <Input id="commercial_name" {...register('commercial_name')} />
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
        <Champ id="constitution_date" label={T.dateConstitution} erreur={errors.constitution_date?.message}>
          <Input id="constitution_date" type="date" {...register('constitution_date')} />
        </Champ>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Champ id="rccm_number" label={`${F.rccm} (facultatif)`} erreur={errors.rccm_number?.message}>
          <Input id="rccm_number" {...register('rccm_number')} />
        </Champ>
        <Champ id="nif_number" label={`${F.nif} (facultatif)`} erreur={errors.nif_number?.message}>
          <Input id="nif_number" {...register('nif_number')} />
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
      <Champ
        id="business_purpose"
        label={`${F.objetSocial} (facultatif)`}
        erreur={errors.business_purpose?.message}
      >
        <Input id="business_purpose" {...register('business_purpose')} />
      </Champ>
      <Boutons enCours={mutation.isPending} onAnnuler={onTermine} />
    </form>
  )
}

function EditionGroupement({
  fiche,
  detail,
  onTermine,
}: {
  fiche: FicheTier
  detail: NonNullable<FicheTier['groupement']>
  onTermine: () => void
}) {
  const queryClient = useQueryClient()
  const [echec, setEchec] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChampsEditionGroupement>({
    resolver: zodResolver(schemaEditionGroupement),
    defaultValues: {
      group_name: detail.group_name,
      group_type: detail.group_type,
      constitution_date: detail.constitution_date,
      intervention_zone: detail.intervention_zone ?? '',
      group_purpose: detail.group_purpose ?? '',
      expected_member_count:
        detail.expected_member_count === null ? '' : String(detail.expected_member_count),
    },
  })

  const mutation = useMutation({
    mutationFn: (c: ChampsEditionGroupement) =>
      modifierGroupement(fiche.id, {
        group_name: c.group_name,
        group_type: c.group_type,
        constitution_date: c.constitution_date,
        intervention_zone: c.intervention_zone || null,
        group_purpose: c.group_purpose || null,
        expected_member_count: c.expected_member_count ? Number(c.expected_member_count) : null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tiers'] })
      onTermine()
    },
    onError: (e) => setEchec(e instanceof ErreurModification && e.detail ? e.detail : F.erreurModification),
  })

  const soumettre = handleSubmit((c) => {
    setEchec(null)
    mutation.mutate(c)
  })

  return (
    <form onSubmit={(e) => void soumettre(e)} noValidate className="space-y-4" aria-label={F.modifierTitre}>
      <Echec message={echec} />
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
        <Champ id="constitution_date" label={T.dateConstitution} erreur={errors.constitution_date?.message}>
          <Input id="constitution_date" type="date" {...register('constitution_date')} />
        </Champ>
      </div>
      <Champ
        id="intervention_zone"
        label={`${F.zoneIntervention} (facultatif)`}
        erreur={errors.intervention_zone?.message}
      >
        <Input id="intervention_zone" {...register('intervention_zone')} />
      </Champ>
      <Champ
        id="group_purpose"
        label={`${F.objetGroupement} (facultatif)`}
        erreur={errors.group_purpose?.message}
      >
        <Input id="group_purpose" {...register('group_purpose')} />
      </Champ>
      <Champ
        id="expected_member_count"
        label={`${F.effectifPrevu} (facultatif)`}
        erreur={errors.expected_member_count?.message}
      >
        <Input
          id="expected_member_count"
          type="number"
          min="1"
          step="1"
          {...register('expected_member_count')}
        />
      </Champ>
      <Boutons enCours={mutation.isPending} onAnnuler={onTermine} />
    </form>
  )
}
