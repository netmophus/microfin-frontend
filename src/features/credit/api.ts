import { AxiosError } from 'axios'

import { api } from '@/lib/api'

/**
 * Module Crédit (CR6a) — produits, demandes, décision.
 *
 * Montants en ENTIERS de francs CFA (comme partout ailleurs). `formatFcfa` vient de l'Épargne
 * (réutilisé, pas redupliqué — contrairement à Parts, qui avait dupliqué un formateur local).
 *
 * Le décaissement, l'échéancier et le remboursement (CR6b-d) n'ont PAS encore de fonctions ici.
 */

export interface ProduitCredit {
  id: string
  code: string
  name: string
  is_provisional: boolean
}

export interface DemandeCredit {
  id: string
  application_number: string
  tier_number: string
  tier_nom: string
  product_code: string
  product_name: string
  montant_demande: number
  duree_echeances: number
  status: string // 'en_instruction' | 'approuve' | 'refuse' | 'decaisse'
  created_at: string
}

export interface DemandeCreditDetail extends DemandeCredit {
  objet: string | null
  montant_decide: number | null
  decided_at: string | null
  motif_decision: string | null
}

export interface CreationDemandeCredit {
  product_id: string
  montant_demande: number
  duree_echeances: number
  objet?: string
}

export interface DecisionCredit {
  decision: 'approuve' | 'refuse'
  montant_decide?: number
  motif: string
}

export async function listerProduitsCredit(): Promise<ProduitCredit[]> {
  const { data } = await api.get<ProduitCredit[]>('/credit/produits')
  return data
}

/** Toutes les demandes dans le périmètre de l'acteur (l'agence cloisonne déjà côté serveur). */
export async function listerDemandesCredit(): Promise<DemandeCredit[]> {
  const { data } = await api.get<DemandeCredit[]>('/credit/demandes')
  return data
}

/** Les demandes d'UN tiers (onglet Crédit de sa fiche) — filtré et cloisonné côté serveur. */
export async function listerDemandesCreditTier(tierId: string): Promise<DemandeCredit[]> {
  const { data } = await api.get<DemandeCredit[]>(`/tiers/${tierId}/demandes-credit`)
  return data
}

export async function lireDemandeCredit(id: string): Promise<DemandeCreditDetail> {
  const { data } = await api.get<DemandeCreditDetail>(`/credit/demandes/${id}`)
  return data
}

export async function creerDemandeCredit(
  tierId: string,
  corps: CreationDemandeCredit,
): Promise<DemandeCredit> {
  const { data } = await api.post<DemandeCredit>(`/tiers/${tierId}/demandes-credit`, corps)
  return data
}

export async function deciderDemandeCredit(
  id: string,
  corps: DecisionCredit,
): Promise<DemandeCreditDetail> {
  const { data } = await api.post<DemandeCreditDetail>(`/credit/demandes/${id}/decision`, corps)
  return data
}

/**
 * Message d'un refus (gate KYC, produit indisponible, décision déjà prise, montant invalide…).
 * Le backend renvoie un `detail` métier lisible qu'on affiche TEL QUEL.
 */
export function messageRefusCredit(erreur: unknown, defaut: string): string {
  if (erreur instanceof AxiosError) {
    const detail = erreur.response?.data?.detail
    if (typeof detail === 'string') return detail
  }
  return defaut
}
