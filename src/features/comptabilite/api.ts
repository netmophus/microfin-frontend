import { AxiosError } from 'axios'

import { api } from '@/lib/api'

/**
 * Plan de comptes (Bloc 1 du paramétrage comptable) — consultation + gestion UNITAIRE.
 * Distinct de l'import CSV en masse (à venir) : ici, un compte à la fois.
 */

export interface CompteResume {
  id: string
  account_number: string
  name: string
  short_name: string | null
  account_class: number
  parent_number: string | null
  normal_side: string // 'D' | 'C'
  is_posting: boolean
  is_system: boolean
  is_provisional: boolean
  is_active: boolean
}

export interface CompteDetail extends CompteResume {
  notes: string | null
  created_at: string
  updated_at: string
}

export interface PageComptes {
  lignes: CompteResume[]
  total: number
  page: number
  taille: number
}

export const TAILLE_PAGE = 25

export interface ParamsListeComptes {
  q?: string
  classe?: number
  inclureInactifs?: boolean
  page?: number
}

export async function listerComptes(params: ParamsListeComptes): Promise<PageComptes> {
  const { data } = await api.get<PageComptes>('/comptabilite/comptes', {
    params: {
      q: params.q?.trim() || undefined,
      classe: params.classe,
      inclure_inactifs: params.inclureInactifs || undefined,
      page: params.page ?? 1,
      taille: TAILLE_PAGE,
    },
  })
  return data
}

export async function lireCompte(id: string): Promise<CompteDetail> {
  const { data } = await api.get<CompteDetail>(`/comptabilite/comptes/${id}`)
  return data
}

export interface CreationCompte {
  account_number: string
  name: string
  short_name?: string | null
  account_class: number
  parent_number?: string | null
  normal_side: 'D' | 'C'
  is_posting: boolean
  notes?: string | null
}

export async function creerCompte(donnees: CreationCompte): Promise<CompteDetail> {
  const { data } = await api.post<CompteDetail>('/comptabilite/comptes', donnees)
  return data
}

export interface ModificationCompte {
  name?: string
  short_name?: string | null
  notes?: string | null
}

export async function modifierCompte(
  id: string,
  modifications: ModificationCompte,
): Promise<CompteDetail> {
  const { data } = await api.patch<CompteDetail>(`/comptabilite/comptes/${id}`, modifications)
  return data
}

/** Motif OBLIGATOIRE : acte sensible sur le plan, tracé (audit avant/après + motif). */
export async function changerSens(
  id: string,
  normalSide: 'D' | 'C',
  motif: string,
): Promise<CompteDetail> {
  const { data } = await api.post<CompteDetail>(`/comptabilite/comptes/${id}/sens`, {
    normal_side: normalSide,
    motif,
  })
  return data
}

export async function desactiverCompte(id: string, motif: string): Promise<CompteDetail> {
  const { data } = await api.post<CompteDetail>(`/comptabilite/comptes/${id}/desactiver`, {
    motif,
  })
  return data
}

/** Message d'un refus serveur (detail métier) affiché TEL QUEL — langage humain, jamais brut. */
export function messageRefusCompte(erreur: unknown, defaut: string): string {
  if (erreur instanceof AxiosError) {
    const detail = erreur.response?.data?.detail
    if (typeof detail === 'string') return detail
  }
  return defaut
}
