import { AxiosError } from 'axios'

import { api } from '@/lib/api'

/**
 * Module Crédit — produits, demandes, décision (CR6a), décaissement + échéancier (CR6b),
 * guichet de remboursement (CR6d).
 *
 * Montants en ENTIERS de francs CFA (comme partout ailleurs). `formatFcfa` vient de l'Épargne
 * (réutilisé, pas redupliqué — contrairement à Parts, qui avait dupliqué un formateur local).
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
  // Pour lister les comptes epargne.accounts éligibles au décaissement sur compte.
  tier_id: string
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
  mode_decaissement: string // 'caisse' | 'epargne'
  // Le compte réellement crédité : la caisse, ou le compte du tiers choisi (mode 'epargne').
  compte_destination_number: string | null
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
  status: string // 'a_echoir' | 'partiellement_paye' | 'paye'
  // CR5b : reflète un versement partiel éventuel — `status` seul ne dit pas ce qui reste dû.
  montant_paye: number
  solde_du: number
}

// Aperçu PUR (CR6b) : mêmes montants qu'une échéance réelle, PAS de `status`/`montant_paye`/
// `solde_du` — rien n'est suivi puisque rien n'est écrit en base.
export type EcheanceApercuCredit = Omit<EcheanceCredit, 'status' | 'montant_paye' | 'solde_du'>

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

export interface DecaissementCredit {
  mode: 'caisse' | 'epargne'
  // Obligatoire si mode='epargne' (le compte epargne.accounts choisi) ; absent si 'caisse'.
  compte_epargne_id?: string
}

// CR5b : `solde_du` (pas `total`) est le montant à présenter/encaisser — une échéance déjà
// partiellement payée (`montant_paye` > 0) ne doit jamais réafficher son montant d'origine
// comme s'il restait intégralement dû.
export interface EcheanceDue {
  numero: number
  due_date: string
  capital: number
  interets: number
  total: number
  montant_paye: number
  solde_du: number
}

// Un résultat de recherche du guichet (CR6d). prochaine_echeance absente = déjà soldé.
export interface DossierRemboursable {
  id: string
  application_number: string
  tier_number: string
  tier_nom: string
  product_name: string
  prochaine_echeance: EcheanceDue | null
}

// CR5b : CE versement — `capital`/`interets`/`montant_total` décrivent ce que CE paiement a
// couvert, pas nécessairement l'échéance entière si `echeance_soldee` est faux.
export interface RemboursementRecu {
  numero: number
  due_date: string
  capital: number
  interets: number
  montant_total: number
  paid_at: string
  solde_du: number
  echeance_soldee: boolean
  echeances_restantes: number
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
 * Décaisse une demande APPROUVÉE : pièce comptable + échéancier générés en une transaction.
 * `corps.mode` : 'caisse' (espèces, défaut) ou 'epargne' (crédit direct sur un compte choisi
 * du tiers, n'importe quel produit).
 */
export async function decaisserDemandeCredit(
  id: string,
  corps: DecaissementCredit,
): Promise<DemandeCreditDecaissee> {
  const { data } = await api.post<DemandeCreditDecaissee>(
    `/credit/demandes/${id}/decaissement`,
    corps,
  )
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
 * Recherche du guichet (CR6d) : crédits DÉCAISSÉS du périmètre par numéro de dossier, numéro de
 * tiers ou nom. Un dossier déjà soldé reste dans les résultats (`prochaine_echeance: null`) —
 * affiché tel quel, jamais un clic qui échouerait.
 */
export async function rechercherRemboursements(q: string): Promise<DossierRemboursable[]> {
  const { data } = await api.get<DossierRemboursable[]>('/credit/recherche-remboursement', {
    params: { q },
  })
  return data
}

/**
 * Règle la prochaine échéance non soldée d'un crédit décaissé, pour son SOLDE RESTANT exact
 * (CR5b — jamais le total d'origine si un versement partiel a déjà eu lieu) — jamais saisi par
 * le caissier, toujours celui déjà connu via la recherche du guichet.
 */
export async function rembourserDemandeCredit(
  id: string,
  montant: number,
): Promise<RemboursementRecu> {
  const { data } = await api.post<RemboursementRecu>(`/credit/demandes/${id}/remboursement`, {
    montant,
  })
  return data
}

// CR5c — reclassification automatique (paliers de souffrance). Palier avant/après en CLAIR
// (code + libellé), pas un UUID nu à résoudre côté écran — le backend l'a déjà fait.
export interface LigneReclassement {
  application_number: string
  tier_avant_code: string | null
  tier_avant_libelle: string | null
  tier_apres_code: string | null
  tier_apres_libelle: string | null
  jours_retard: number
  encours_actuel: number
  provision_avant: number
  provision_apres: number
}

// Aperçu (dry-run) : même forme que LigneReclassement, plus le motif de refus s'il y en
// aurait un — connu SANS rien écrire.
export interface LigneApercuReclassement extends LigneReclassement {
  rattachement_manquant: string | null
}

export interface ApercuReclassement {
  dossiers_evalues: number
  a_reclasser: number
  rattachements_manquants: number
  lignes: LigneApercuReclassement[]
}

export interface RapportReclassement {
  dossiers_evalues: number
  reclasses: number
  ignores_rattachement_manquant: string[]
  lignes: LigneReclassement[]
}

/** Prévisualisation OBLIGATOIRE avant exécution (dry-run) : calcule sans rien écrire. */
export async function previsualiserReclassement(): Promise<ApercuReclassement> {
  const { data } = await api.post<ApercuReclassement>('/credit/delinquency/apercu')
  return data
}

/**
 * Reclasse tous les crédits décaissés dont la situation le justifie — acte D'INSTITUTION
 * réservé DIRECTION. Chaque dossier est committé séparément côté serveur : un paramétrage
 * incomplet sur l'un n'empêche pas les autres.
 */
export async function executerReclassement(): Promise<RapportReclassement> {
  const { data } = await api.post<RapportReclassement>('/credit/delinquency/executer')
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
