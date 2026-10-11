import { z } from 'zod'

import { LIBELLES } from '@/libelles/fr'

/**
 * Validation des formulaires de création — un schéma par type, MIROIR des bornes backend.
 *
 * Trois schémas isolés plutôt qu'un schéma unique à branches : chacun valide exactement les
 * champs de son type, et ne connaît pas les autres. Changer de type ne laisse traîner aucune
 * valeur d'un autre schéma (le bug classique du formulaire unique : « j'ai rempli le RCCM puis
 * changé de type et la valeur est restée »).
 */

const T = LIBELLES.tiersCreation

// Pas de date dans le futur (le backend l'impose aussi). Comparaison de chaînes 'YYYY-MM-DD'.
const pasDansLeFutur = (v: string) => v === '' || v <= new Date().toISOString().slice(0, 10)

// Champs communs à tout tiers. Facultatifs : le backend dérive l'agence du claim pour un
// utilisateur cloisonné ; le sélecteur d'agence n'apparaît que pour une portée réseau.
const commun = {
  primary_phone: z.string().trim().max(30, T.trop_long).optional(),
  primary_agency_id: z.string().optional(),
}

// Capital en francs ENTIERS : chiffres seulement (espaces de groupement tolérés), aucune décimale.
const montantEntier = z
  .string()
  .trim()
  .refine((v) => /^\d*$/.test(v.replace(/\s/g, '')), T.capitalEntier)

/** « 1 000 000 » -> 1000000 ; vide -> null. La saisie a déjà été validée par `montantEntier`. */
export function enFrancs(saisie: string | undefined): number | null {
  const chiffres = (saisie ?? '').replace(/\s/g, '')
  return chiffres === '' ? null : Number(chiffres)
}

export const schemaIndividu = z.object({
  last_name: z.string().trim().min(1, T.requis).max(100, T.trop_long),
  first_name: z.string().trim().min(1, T.requis).max(100, T.trop_long),
  birth_date: z.string().min(1, T.requis).refine(pasDansLeFutur, T.dateFuture),
  gender: z.string().min(1, T.requis),
  nationality_id: z.string().min(1, T.requis),
  profession: z.string().trim().max(200, T.trop_long).optional(),
  ...commun,
})

export const schemaPersonneMorale = z.object({
  legal_name: z.string().trim().min(1, T.requis).max(300, T.trop_long),
  legal_form: z.string().min(1, T.requis),
  constitution_date: z.string().min(1, T.requis).refine(pasDansLeFutur, T.dateFuture),
  headquarters_country_id: z.string().min(1, T.requis),
  capital_amount: montantEntier.optional(),
  capital_currency_id: z.string().optional(),
  commercial_name: z.string().trim().max(300, T.trop_long).optional(),
  rccm_number: z.string().trim().max(50, T.trop_long).optional(),
  nif_number: z.string().trim().max(50, T.trop_long).optional(),
  business_purpose: z.string().trim().optional(),
  ...commun,
})

export const schemaGroupement = z.object({
  group_name: z.string().trim().min(1, T.requis).max(300, T.trop_long),
  group_type: z.string().min(1, T.requis),
  constitution_date: z.string().min(1, T.requis).refine(pasDansLeFutur, T.dateFuture),
  intervention_zone: z.string().trim().max(200, T.trop_long).optional(),
  group_purpose: z.string().trim().optional(),
  expected_member_count: z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) > 0), T.effectifInvalide)
    .optional(),
  ...commun,
})

export type ChampsIndividu = z.infer<typeof schemaIndividu>
export type ChampsPersonneMorale = z.infer<typeof schemaPersonneMorale>
export type ChampsGroupement = z.infer<typeof schemaGroupement>

// --- édition d'une PM ou d'un groupement (tous les champs du profil) ---------------------

export const schemaEditionPersonneMorale = z.object({
  legal_name: z.string().trim().min(1, T.requis).max(300, T.trop_long),
  commercial_name: z.string().trim().max(300, T.trop_long),
  legal_form: z.string().min(1, T.requis),
  rccm_number: z.string().trim().max(50, T.trop_long),
  nif_number: z.string().trim().max(50, T.trop_long),
  constitution_date: z.string().min(1, T.requis).refine(pasDansLeFutur, T.dateFuture),
  capital_amount: montantEntier,
  capital_currency_id: z.string(),
  business_purpose: z.string().trim(),
  headquarters_country_id: z.string().min(1, T.requis),
})

export const schemaEditionGroupement = z.object({
  group_name: z.string().trim().min(1, T.requis).max(300, T.trop_long),
  group_type: z.string().min(1, T.requis),
  constitution_date: z.string().min(1, T.requis).refine(pasDansLeFutur, T.dateFuture),
  intervention_zone: z.string().trim().max(200, T.trop_long),
  group_purpose: z.string().trim(),
  expected_member_count: z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) > 0), T.effectifInvalide),
})

export type ChampsEditionPersonneMorale = z.infer<typeof schemaEditionPersonneMorale>
export type ChampsEditionGroupement = z.infer<typeof schemaEditionGroupement>
