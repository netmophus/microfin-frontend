import { api } from '@/lib/api'

/**
 * Référentiels des formulaires tiers — pays (nationalité, siège) et devises (capital).
 *
 * Sources : GET /countries et GET /currencies (module Paramétrage). Authentifié suffit ;
 * la vraie protection reste sur POST /tiers.
 */

export interface Pays {
  id: string
  code: string
  name: string
}

export interface Devise {
  id: string
  code: string
  name: string
  decimal_places: number
}

export async function listerPays(): Promise<Pays[]> {
  const reponse = await api.get<Pays[]>('/countries')
  return reponse.data
}

export async function listerDevises(): Promise<Devise[]> {
  const reponse = await api.get<Devise[]>('/currencies')
  return reponse.data
}
