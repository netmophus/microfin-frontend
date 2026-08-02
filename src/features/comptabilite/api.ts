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

// --- Import / export CSV (Bloc 2) -------------------------------------------------------
//
// Flux en DEUX temps : apercevoirImportComptes lit et valide SANS RIEN ÉCRIRE (anomalies, ou
// le diff de ce qui changerait, + une empreinte) ; confirmerImportComptes réécrit — le MÊME
// fichier (gardé en mémoire côté écran, jamais reposé par l'utilisateur) et la MÊME empreinte
// sont exigés, sinon le serveur refuse (un fichier différent aurait pu se substituer entre
// les deux appels).

export interface DiffChampCompte {
  champ: string
  avant: string
  apres: string
}

export interface CompteApercuLigne {
  account_number: string
  name: string
  diffs: DiffChampCompte[]
}

export interface ApercuImportComptes {
  anomalies: string[]
  empreinte: string | null
  a_creer: CompteApercuLigne[]
  a_modifier: CompteApercuLigne[]
  inchanges: number
}

export interface ConfirmationImportComptes {
  crees: number
  mis_a_jour: number
  provisoire_leve: boolean
}

/** Sans Content-Type explicite, le navigateur pose lui-même le boundary multipart — le
 * poser à la main casserait l'upload (l'instance `api` fixe 'application/json' par défaut). */
const ENTETES_MULTIPART = { headers: { 'Content-Type': undefined } }

export async function apercevoirImportComptes(fichier: File): Promise<ApercuImportComptes> {
  const corps = new FormData()
  corps.append('fichier', fichier)
  const { data } = await api.post<ApercuImportComptes>(
    '/comptabilite/comptes/import/apercu',
    corps,
    ENTETES_MULTIPART,
  )
  return data
}

export interface ConfirmationImportParams {
  fichier: File
  empreinte: string
  motif: string
  leverProvisoire: boolean
}

export async function confirmerImportComptes(
  params: ConfirmationImportParams,
): Promise<ConfirmationImportComptes> {
  const corps = new FormData()
  corps.append('fichier', params.fichier)
  corps.append('empreinte', params.empreinte)
  corps.append('motif', params.motif)
  corps.append('lever_provisoire', params.leverProvisoire ? 'true' : 'false')
  const { data } = await api.post<ConfirmationImportComptes>(
    '/comptabilite/comptes/import/confirmer',
    corps,
    ENTETES_MULTIPART,
  )
  return data
}

/** Déclenche un téléchargement — passe par `api` (jeton + cookie) plutôt qu'un lien direct,
 * qui n'aurait porté ni l'un ni l'autre. */
export async function exporterComptes(inclureInactifs: boolean): Promise<void> {
  const reponse = await api.get<Blob>('/comptabilite/comptes/export', {
    params: { inclure_inactifs: inclureInactifs },
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(reponse.data)
  const lien = document.createElement('a')
  lien.href = url
  lien.download = 'plan_comptable.csv'
  document.body.appendChild(lien)
  lien.click()
  document.body.removeChild(lien)
  window.URL.revokeObjectURL(url)
}

// --- Rattachements (Bloc 5) : sélecteur partagé + les 3 écrans de paramétrage ------------
//
// Chaque sélecteur de compte ne propose QUE des comptes de saisie actifs — filtré côté
// SERVEUR (comptes.lister_pour_selecteur), jamais seulement à l'affichage. Le serveur
// revérifie aussi à l'écriture (compte_saisie_actif) : ce sélecteur est un confort, pas la
// seule protection.

export interface CompteSelecteur {
  id: string
  account_number: string
  name: string
}

export async function listerComptesSelecteur(q?: string): Promise<CompteSelecteur[]> {
  const { data } = await api.get<CompteSelecteur[]>('/comptabilite/comptes/selecteur', {
    params: { q: q?.trim() || undefined },
  })
  return data
}

/** Un compte résolu — numéro + libellé, jamais l'UUID (règle du projet), partagé par les 3
 * écrans de rattachement (produits, agences, parts). */
export interface CompteRattachement {
  account_number: string
  name: string
}

// --- 5.1 Rattachements épargne (par produit) --------------------------------------------

export interface RattachementsProduit {
  id: string
  code: string
  name: string
  compte_epargne: CompteRattachement | null
  compte_epargne_client: CompteRattachement | null
  compte_charge_interet: CompteRattachement | null
}

export interface ModificationRattachementsProduit {
  compte_epargne: string | null
  compte_epargne_client: string | null
  compte_charge_interet: string | null
  motif: string
}

export async function listerRattachementsProduits(): Promise<RattachementsProduit[]> {
  const { data } = await api.get<RattachementsProduit[]>('/epargne/produits/rattachements')
  return data
}

export async function modifierRattachementsProduit(
  id: string,
  modifications: ModificationRattachementsProduit,
): Promise<RattachementsProduit> {
  const { data } = await api.patch<RattachementsProduit>(
    `/epargne/produits/${id}/rattachements`,
    modifications,
  )
  return data
}

// --- 5.2 Caisse par agence -----------------------------------------------------------------

export interface AgenceRattachement {
  id: string
  code: string
  name: string
  compte_caisse: CompteRattachement | null
}

export async function listerRattachementsAgences(): Promise<AgenceRattachement[]> {
  const { data } = await api.get<AgenceRattachement[]>('/agencies/rattachements')
  return data
}

export async function modifierCompteCaisse(
  id: string,
  compteCaisse: string | null,
  motif: string,
): Promise<AgenceRattachement> {
  const { data } = await api.patch<AgenceRattachement>(`/agencies/${id}/compte-caisse`, {
    compte_caisse: compteCaisse,
    motif,
  })
  return data
}

// --- 5.3 Paramètres des parts sociales -----------------------------------------------------

export interface ParametresParts {
  unit_value: number
  minimum_shares: number
  is_refundable: boolean
  membership_on: 'souscription' | 'liberation'
  compte_parts_liberees: CompteRattachement | null
  compte_parts_non_liberees: CompteRattachement | null
  is_provisional: boolean
}

export interface ModificationParametresParts {
  unit_value: number
  minimum_shares: number
  is_refundable: boolean
  membership_on: 'souscription' | 'liberation'
  compte_parts_liberees: string | null
  compte_parts_non_liberees: string | null
  motif: string
}

export async function lireParametresParts(): Promise<ParametresParts> {
  const { data } = await api.get<ParametresParts>('/tiers/parts/parametres')
  return data
}

export async function modifierParametresParts(
  modifications: ModificationParametresParts,
): Promise<ParametresParts> {
  const { data } = await api.patch<ParametresParts>('/tiers/parts/parametres', modifications)
  return data
}
