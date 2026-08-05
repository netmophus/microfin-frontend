import { AxiosError } from 'axios'

import { api } from '@/lib/api'

/**
 * Module Crédit — produits, demandes, décision (CR6a), décaissement + échéancier (CR6b).
 *
 * Montants en ENTIERS de francs CFA (comme partout ailleurs). `formatFcfa` vient de l'Épargne
 * (réutilisé, pas redupliqué — contrairement à Parts, qui avait dupliqué un formateur local).
 *
 * Le remboursement (CR6d, guichet) n'a pas encore de fonctions ici.
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
  // Membre ou client — dit quel compte de crédit reçoit la créance au décaissement (ancré à
  // cet instant, jamais recalculé ensuite, comme le routage épargne/parts).
  is_member: boolean
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

export interface DemandeCreditDecaissee extends DemandeCreditDetail {
  disbursed_at: string | null
  compte_credit_number: string | null
  nb_echeances: number
  premiere_echeance_le: string | null
  derniere_echeance_le: string | null
}

export interface EcheanceCredit {
  numero: number
  due_date: string
  capital: number
  interets: number
  total: number
  capital_restant_du: number
  status: string // 'a_echoir' | 'paye'
}

// Aperçu PUR (CR6b) : mêmes montants qu'une échéance réelle, PAS de `status` — rien n'est
// suivi puisque rien n'est écrit en base.
export type EcheanceApercuCredit = Omit<EcheanceCredit, 'status'>

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

/** Décaisse une demande APPROUVÉE : pièce comptable + échéancier générés en une transaction. */
export async function decaisserDemandeCredit(id: string): Promise<DemandeCreditDecaissee> {
  const { data } = await api.post<DemandeCreditDecaissee>(`/credit/demandes/${id}/decaissement`)
  return data
}

/** L'échéancier persisté d'une demande décaissée (vide si pas encore décaissée). */
export async function lireEcheancierCredit(id: string): Promise<EcheanceCredit[]> {
  const { data } = await api.get<EcheanceCredit[]>(`/credit/demandes/${id}/echeancier`)
  return data
}

/**
 * Aperçu PUR de l'échéancier d'une demande APPROUVÉE — même moteur que le décaissement réel,
 * RIEN N'EST ÉCRIT en base. Montants garantis identiques à l'échéancier réel ; dates
 * indicatives (calculées comme si le décaissement avait lieu aujourd'hui).
 */
export async function lireApercuEcheancierCredit(id: string): Promise<EcheanceApercuCredit[]> {
  const { data } = await api.get<EcheanceApercuCredit[]>(
    `/credit/demandes/${id}/echeancier-apercu`,
  )
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
