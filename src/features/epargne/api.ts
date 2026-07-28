import { AxiosError } from 'axios'

import { api } from '@/lib/api'

/**
 * Module Épargne (F1) — produits, comptes d'un membre, ouverture, détail.
 *
 * Les montants sont des ENTIERS de francs CFA (le backend n'envoie jamais de décimale). On les
 * affiche via `formatFcfa`, sans ambiguïté d'unité.
 */

export interface ProduitEpargne {
  id: string
  code: string
  name: string
  type: string
  is_provisional: boolean
}

export interface CompteEpargne {
  id: string
  account_number: string
  product_code: string
  product_name: string
  product_type: string
  currency: string
  balance: number
  status: string // 'actif' | 'cloture'
  is_provisional: boolean
}

export interface MouvementEpargne {
  id: string
  sens: string
  amount: number
  balance_after: number
  operation_type: string
  label: string | null
  created_at: string
  entry_number: string | null
}

export interface CompteEpargneDetail extends CompteEpargne {
  opened_at: string
  closed_at: string | null
  mouvements: MouvementEpargne[]
}

export async function listerProduits(): Promise<ProduitEpargne[]> {
  const { data } = await api.get<ProduitEpargne[]>('/epargne/produits')
  return data
}

export async function listerComptesMembre(tierId: string): Promise<CompteEpargne[]> {
  const { data } = await api.get<CompteEpargne[]>(`/tiers/${tierId}/comptes-epargne`)
  return data
}

export async function ouvrirCompte(tierId: string, productId: string): Promise<CompteEpargne> {
  const { data } = await api.post<CompteEpargne>(`/tiers/${tierId}/comptes-epargne`, {
    product_id: productId,
  })
  return data
}

export async function lireCompte(compteId: string): Promise<CompteEpargneDetail> {
  const { data } = await api.get<CompteEpargneDetail>(`/epargne/comptes/${compteId}`)
  return data
}

// --- Guichet : recherche par numéro + dépôt/retrait -----------------------------------

/** Ce que le caissier voit après recherche : le NOM du membre est proéminent (vérif humaine). */
export interface CompteGuichet {
  id: string
  account_number: string
  tier_id: string
  membre_nom: string
  product_name: string
  product_type: string
  currency: string
  balance: number
  status: string
  is_provisional: boolean
}

export interface ResultatOperation {
  account_number: string
  nouveau_solde: number
  entry_number: string | null
}

export async function rechercherCompte(numero: string): Promise<CompteGuichet> {
  const { data } = await api.get<CompteGuichet>('/epargne/recherche-compte', {
    params: { numero },
  })
  return data
}

export async function deposerGuichet(compteId: string, montant: number): Promise<ResultatOperation> {
  const { data } = await api.post<ResultatOperation>(`/epargne/comptes/${compteId}/depot`, {
    montant,
  })
  return data
}

export async function retirerGuichet(
  compteId: string,
  montant: number,
): Promise<ResultatOperation> {
  const { data } = await api.post<ResultatOperation>(`/epargne/comptes/${compteId}/retrait`, {
    montant,
  })
  return data
}

/** Francs CFA entiers, séparateur de milliers, jamais de décimale. Ex. « 110 000 F ». */
export function formatFcfa(montant: number): string {
  return `${montant.toLocaleString('fr-FR')} F`
}

/**
 * Message d'un refus d'ouverture. Le backend renvoie un `detail` métier (gate KYC : « … n'est
 * pas actif … ») qu'on affiche TEL QUEL — on dit POURQUOI, jamais une erreur brute.
 */
export function messageRefus(erreur: unknown, defaut: string): string {
  if (erreur instanceof AxiosError) {
    const detail = erreur.response?.data?.detail
    if (typeof detail === 'string') return detail
  }
  return defaut
}
