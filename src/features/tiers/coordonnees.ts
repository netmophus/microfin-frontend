import { AxiosError } from 'axios'

import { api } from '@/lib/api'

/**
 * Coordonnées d'un tiers (T2b) — téléphones / emails / adresses.
 *
 * POINT CLÉ, le téléphone : le backend REFUSE par défaut un numéro qu'il ne reconnaît pas
 * (422 { message, forcable }). `forcable=true` = numéro de bonne forme, juste non reconnu →
 * l'écran PEUT proposer « enregistrer quand même » (forcer). `forcable=false` = charabia →
 * l'écran ne propose RIEN, il faut corriger. On ne bascule jamais en forçage tout seul.
 */

export interface Contact {
  id: string
  contact_type: 'phone' | 'email' | 'address'
  contact_subtype: string | null
  is_primary: boolean
  is_verified: boolean
  phone_number: string | null
  phone_raw: string | null
  phone_country_code: string | null
  phone_normalized: boolean
  email_address: string | null
  address_line1: string | null
  address_line2: string | null
  quarter: string | null
  landmark: string | null
  city_id: string | null
  region_id: string | null
  country_id: string | null
  postal_code: string | null
}

export interface DonneesAdresse {
  address_line1?: string | null
  address_line2?: string | null
  quarter?: string | null
  landmark?: string | null
  postal_code?: string | null
  contact_subtype?: string | null
  is_primary: boolean
}

/** Refus d'un téléphone. `forcable` décide si l'écran offre « enregistrer quand même ». */
export class ErreurTelephone extends Error {
  readonly forcable: boolean

  constructor(message: string, forcable: boolean) {
    super(message)
    this.name = 'ErreurTelephone'
    this.forcable = forcable
  }
}

/** Erreur générique d'une opération sur les coordonnées (hors le cas téléphone). */
export class ErreurCoordonnee extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErreurCoordonnee'
  }
}

export async function listerContacts(tierId: string): Promise<Contact[]> {
  const reponse = await api.get<Contact[]>(`/tiers/${tierId}/contacts`)
  return reponse.data
}

export async function ajouterTelephone(
  tierId: string,
  donnees: { phone: string; contact_subtype?: string | null; is_primary: boolean; forcer: boolean },
): Promise<Contact> {
  try {
    const reponse = await api.post<Contact>(`/tiers/${tierId}/phones`, donnees)
    return reponse.data
  } catch (erreur) {
    if (erreur instanceof AxiosError && erreur.response?.status === 422) {
      const detail = erreur.response.data?.detail as { message?: string; forcable?: boolean }
      throw new ErreurTelephone(detail?.message ?? '', detail?.forcable ?? false)
    }
    throw erreur
  }
}

export async function ajouterEmail(
  tierId: string,
  donnees: { email: string; contact_subtype?: string | null; is_primary: boolean },
): Promise<Contact> {
  const reponse = await api.post<Contact>(`/tiers/${tierId}/emails`, donnees)
  return reponse.data
}

export async function ajouterAdresse(tierId: string, donnees: DonneesAdresse): Promise<Contact> {
  const reponse = await api.post<Contact>(`/tiers/${tierId}/addresses`, donnees)
  return reponse.data
}

export async function definirPrincipalContact(tierId: string, contactId: string): Promise<Contact> {
  const reponse = await api.post<Contact>(`/tiers/${tierId}/contacts/${contactId}/set-primary`)
  return reponse.data
}

export async function supprimerContact(
  tierId: string,
  contactId: string,
  motif: string | null,
): Promise<void> {
  await api.delete(`/tiers/${tierId}/contacts/${contactId}`, {
    data: motif?.trim() ? { motif: motif.trim() } : {},
  })
}
