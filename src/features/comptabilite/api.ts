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

// --- Rapports (R1 grand livre, R2 balance) — lecture pure -----------------------------------
//
// Sélecteur DÉDIÉ : contrairement à /selecteur (rattachement), celui-ci propose AUSSI les
// comptes désactivés — un grand livre doit rester consultable même après désactivation du
// compte. is_active est exposé pour que l'écran le signale, dans le menu ET une fois choisi.

export interface CompteSelecteurRapport extends CompteSelecteur {
  is_active: boolean
}

export async function listerComptesSelecteurRapport(q?: string): Promise<CompteSelecteurRapport[]> {
  const { data } = await api.get<CompteSelecteurRapport[]>(
    '/comptabilite/comptes/selecteur-rapport',
    { params: { q: q?.trim() || undefined } },
  )
  return data
}

export interface CompteRapport {
  account_number: string
  name: string
  is_active: boolean
}

export interface LigneGrandLivre {
  entry_date: string
  entry_number: string | null
  journal_code: string
  label: string
  side: 'D' | 'C'
  amount: number
  solde_cumule: number
}

export interface PageGrandLivre {
  compte: CompteRapport
  solde_ouverture: number
  lignes: LigneGrandLivre[]
  total: number
  page: number
  taille: number
}

export interface ParamsGrandLivre {
  compteId: string
  dateDebut?: string
  dateFin?: string
  page?: number
}

export async function chargerGrandLivre(params: ParamsGrandLivre): Promise<PageGrandLivre> {
  const { data } = await api.get<PageGrandLivre>('/comptabilite/grand-livre', {
    params: {
      compte_id: params.compteId,
      date_debut: params.dateDebut || undefined,
      date_fin: params.dateFin || undefined,
      page: params.page ?? 1,
    },
  })
  return data
}

export interface LigneBalance {
  account_number: string
  name: string
  solde_ouverture: number
  total_debit: number
  total_credit: number
  solde_cloture: number
}

export interface Balance {
  date_debut: string | null
  date_fin: string | null
  lignes: LigneBalance[]
  total_debit: number
  total_credit: number
  equilibree: boolean
}

export interface ParamsBalance {
  dateDebut?: string
  dateFin?: string
  inclureSansMouvement?: boolean
}

export async function chargerBalance(params: ParamsBalance): Promise<Balance> {
  const { data } = await api.get<Balance>('/comptabilite/balance', {
    params: {
      date_debut: params.dateDebut || undefined,
      date_fin: params.dateFin || undefined,
      inclure_sans_mouvement: params.inclureSansMouvement || undefined,
    },
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

// --- Vocabulaire partagé « paramètres de calcul » (méthode de solde, base jours, arrondi) --
//
// Ex-section 5.2 « Paramètres d'intérêt épargne » : l'écran et l'endpoint comptable
// (parametres-interet, compta.plan.manage) ont été RETIRÉS — deux chemins d'écriture sur les
// mêmes champs que PageProduitsEpargne.tsx (epargne.product.manage) créaient une collision
// silencieuse (dernier écrivain gagne, voir CLAUDE.md §12). Le taux et les paramètres de
// calcul ne vivent plus QUE côté admin fonctionnel (`epargne/api.ts::modifierProduit`).
// Ces 3 constantes RESTENT ici : réimportées par `epargne/api.ts` pour ce seul écran survivant.

export const METHODES_CALCUL_SOLDE = ['min_periode', 'moyen_quotidien', 'fin_periode'] as const
export type MethodeCalculSolde = (typeof METHODES_CALCUL_SOLDE)[number]

export const REGLES_ARRONDI = ['plus_proche', 'plancher'] as const
export type RegleArrondi = (typeof REGLES_ARRONDI)[number]

export const BASES_JOURS = [360, 365] as const
export type BaseJours = (typeof BASES_JOURS)[number]

// --- 5.2 Caisse par agence -----------------------------------------------------------------

// Un poste ACTIF du module Caisse (Bloc A/B) dont le compte diffère de `compte_caisse`
// ci-dessous — Agency.compte_caisse_id et caisse.postes sont deux colonnes INDÉPENDANTES
// depuis la migration 0041 : rien ne les synchronise. Signal de dérive, jamais bloquant —
// modifier ce rattachement reste légitime tant que des guichets non migrés en dépendent.
export interface PosteDivergent {
  code: string
  libelle: string
  compte_caisse: CompteRattachement | null
}

export interface AgenceRattachement {
  id: string
  code: string
  name: string
  compte_caisse: CompteRattachement | null
  postes_divergents: PosteDivergent[]
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

// --- 5.2bis Caisse — niveaux coffre/principale par agence (chantier coffre-fort/caisses,
// sous-chantier 1, Bloc 2) -------------------------------------------------------------------
//
// Le niveau SECONDAIRE n'est PAS ici : il se rattache par poste (écran « Postes de caisse »,
// compte_caisse ci-dessus reste distinct). Un niveau non paramétré (`compte_caisse: null`)
// est un état légitime, jamais une erreur — voir app/modules/caisse/niveaux.py.

export type NiveauCaisseCode = 'coffre' | 'principale'

export interface NiveauCaisseItem {
  niveau: NiveauCaisseCode
  compte_caisse: CompteRattachement | null
}

export interface AgenceNiveauxCaisse {
  agency_id: string
  agency_nom: string
  niveaux: NiveauCaisseItem[]
}

export async function listerNiveauxCaisse(): Promise<AgenceNiveauxCaisse[]> {
  const { data } = await api.get<AgenceNiveauxCaisse[]>('/caisse/niveaux')
  return data
}

/** Compte hors rubrique 1011 : le serveur refuse (422, CompteHorsCaisseError) — le message
 * (`messageRefusCompte`) porte déjà le détail, affiché tel quel. */
export async function rattacherNiveauCaisse(
  agencyId: string,
  niveau: NiveauCaisseCode,
  compteCaisse: string | null,
  motif: string,
): Promise<AgenceNiveauxCaisse> {
  const { data } = await api.patch<AgenceNiveauxCaisse>(
    `/caisse/agences/${agencyId}/niveaux/${niveau}`,
    { compte_caisse: compteCaisse, motif },
  )
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

// --- 5.4 Paliers de souffrance (crédit, CR5a) ----------------------------------------------

export interface PalierSouffrance {
  id: string
  code: string
  libelle: string
  seuil_jours: number
  taux_provision_bp: number
  compte_encours: CompteRattachement | null
  compte_dotation: CompteRattachement | null
  // Bilan (contra-actif) qui porte la provision accumulée / produit de reprise — un palier à
  // taux 0 (ex. retard simple) n'en a besoin d'aucun, voir reclassification.py.
  compte_provision: CompteRattachement | null
  compte_reprise: CompteRattachement | null
  is_terminal: boolean
  is_provisional: boolean
}

export interface EcriturePalier {
  code: string
  libelle: string
  seuil_jours: number
  taux_provision_bp: number
  compte_encours: string | null
  compte_dotation: string | null
  compte_provision: string | null
  compte_reprise: string | null
  is_terminal: boolean
  motif: string
}

export async function listerPaliersSouffrance(): Promise<PalierSouffrance[]> {
  const { data } = await api.get<PalierSouffrance[]>('/credit/paliers-souffrance')
  return data
}

export async function creerPalierSouffrance(corps: EcriturePalier): Promise<PalierSouffrance> {
  const { data } = await api.post<PalierSouffrance>('/credit/paliers-souffrance', corps)
  return data
}

export async function modifierPalierSouffrance(
  id: string,
  corps: EcriturePalier,
): Promise<PalierSouffrance> {
  const { data } = await api.patch<PalierSouffrance>(`/credit/paliers-souffrance/${id}`, corps)
  return data
}

export async function retirerPalierSouffrance(id: string, motif: string): Promise<void> {
  await api.post(`/credit/paliers-souffrance/${id}/retirer`, { motif })
}

// --- Saisie manuelle d'écriture (OD), chantier P1 lot 1 ------------------------------------
//
// Journal OD (Opérations diverses) UNIQUEMENT — jamais un champ envoyé par cet écran, c'est le
// serveur qui l'impose structurellement (voir comptabilite/ecritures_od.py côté backend).
// `account_number`, pas un UUID : SelecteurCompte (filtre 'saisie') ne connaît que des numéros.

export interface LigneSaisieOD {
  account_number: string
  side: 'D' | 'C'
  amount: number
  label?: string | null
}

export interface CreationEcritureOD {
  entry_date: string
  description: string
  lignes: LigneSaisieOD[]
}

export interface LigneEcritureOD {
  account_number: string
  name: string
  side: 'D' | 'C'
  amount: number
  label: string | null
}

// `equilibree`/`nb_lignes` évitent à l'écran de recalculer ce que le serveur sait déjà — pour
// griser « Valider » (nb_lignes < 2 OU déséquilibrée) sans requête supplémentaire.
export interface EcritureODResume {
  id: string
  entry_number: string | null
  entry_date: string
  description: string
  status: 'brouillon' | 'validee'
  nb_lignes: number
  total_debit: number
  total_credit: number
  equilibree: boolean
  est_contre_passation: boolean
  deja_contre_passee: boolean
}

export interface EcritureODDetail extends EcritureODResume {
  lignes: LigneEcritureOD[]
}

export interface PageEcrituresOD {
  lignes: EcritureODResume[]
  total: number
  page: number
  taille: number
}

export const TAILLE_PAGE_ECRITURES_OD = 50

export async function listerEcrituresOD(page = 1): Promise<PageEcrituresOD> {
  const { data } = await api.get<PageEcrituresOD>('/comptabilite/ecritures', {
    params: { page, taille: TAILLE_PAGE_ECRITURES_OD },
  })
  return data
}

export async function lireEcritureOD(id: string): Promise<EcritureODDetail> {
  const { data } = await api.get<EcritureODDetail>(`/comptabilite/ecritures/${id}`)
  return data
}

export async function creerEcritureOD(corps: CreationEcritureOD): Promise<EcritureODDetail> {
  const { data } = await api.post<EcritureODDetail>('/comptabilite/ecritures', corps)
  return data
}

export async function validerEcritureOD(id: string): Promise<EcritureODDetail> {
  const { data } = await api.post<EcritureODDetail>(`/comptabilite/ecritures/${id}/validation`)
  return data
}

export async function contrePasserEcritureOD(id: string): Promise<EcritureODDetail> {
  const { data } = await api.post<EcritureODDetail>(
    `/comptabilite/ecritures/${id}/contre-passation`,
  )
  return data
}

export async function supprimerEcritureOD(id: string): Promise<void> {
  await api.delete(`/comptabilite/ecritures/${id}`)
}

// --- Clôture d'exercice (chantier P1, lot b1) -----------------------------------------------
//
// Clôture TECHNIQUE uniquement : solde les comptes de charges/produits (classe 6/7) vers 591
// (« Excédent ou déficit en instance d'approbation »). L'affectation du résultat (591 -> réserves
// et/ou 58, après approbation de l'assemblée générale) est le lot b2a, plus bas dans ce fichier.

export interface ExerciceResume {
  id: string
  code: string
  label: string
  date_debut: string
  date_fin: string
  status: 'ouvert' | 'clos'
  resultat_affecte: boolean
  a_nouveaux_generes: boolean
}

export interface LigneResultatCloture {
  account_number: string
  name: string
  account_class: number
  total_debit: number
  total_credit: number
  side: 'D' | 'C'
  amount: number
}

export interface BrouillonBloquant {
  entry_id: string
  journal_code: string
  entry_date: string
  description: string
}

export interface ApercuCloture {
  exercice: ExerciceResume
  resultat: number
  compte_resultat: string
  lignes: LigneResultatCloture[]
  brouillons_bloquants: BrouillonBloquant[]
  cloturable: boolean
}

export interface ClotureExerciceResultat {
  exercice: ExerciceResume
  entry_number: string
  resultat: number
}

export async function listerExercices(): Promise<ExerciceResume[]> {
  const { data } = await api.get<ExerciceResume[]>('/comptabilite/exercices')
  return data
}

export async function previsualiserCloture(exerciceId: string): Promise<ApercuCloture> {
  const { data } = await api.get<ApercuCloture>(
    `/comptabilite/exercices/${exerciceId}/previsualisation-cloture`,
  )
  return data
}

export async function cloturerExercice(exerciceId: string): Promise<ClotureExerciceResultat> {
  const { data } = await api.post<ClotureExerciceResultat>(
    `/comptabilite/exercices/${exerciceId}/cloture`,
  )
  return data
}

// --- Affectation du résultat (chantier P1, lot b2a) ------------------------------------------
//
// Ventilation À LA MAIN (pas de taux automatique) : réserve générale (5521), réserves
// facultatives (5522), autres réserves (5523), report à nouveau (58). Sur un déficit, seul
// report_a_nouveau est accepté (refusé côté serveur si les réserves sont non nulles) — l'écran
// ne propose même pas les champs réserves dans ce cas, voir PageExercices.tsx.
// 592 n'est JAMAIS utilisé (décision actée) : 591 solde directement vers réserves/58.

export interface ApercuAffectation {
  exercice: ExerciceResume
  montant: number | null
  deja_affecte: boolean
  affectable: boolean
}

export interface VentilationAffectation {
  reserve_generale: number
  reserves_facultatives: number
  autres_reserves: number
  report_a_nouveau: number
}

export interface AffectationResultatResultat {
  exercice: ExerciceResume
  entry_number: string
  montant: number
  ventilation: VentilationAffectation
}

export async function previsualiserAffectation(exerciceId: string): Promise<ApercuAffectation> {
  const { data } = await api.get<ApercuAffectation>(
    `/comptabilite/exercices/${exerciceId}/previsualisation-affectation`,
  )
  return data
}

export async function affecterResultat(
  exerciceId: string,
  ventilation: VentilationAffectation,
): Promise<AffectationResultatResultat> {
  const { data } = await api.post<AffectationResultatResultat>(
    `/comptabilite/exercices/${exerciceId}/affectation`,
    ventilation,
  )
  return data
}

// --- À-nouveaux (chantier P1, lot b2b) --------------------------------------------------------
//
// Report des soldes de clôture des comptes de BILAN (classes 1-5) de l'exercice source vers
// l'exercice suivant, journal AN. Indépendant de l'affectation du résultat (b2a, décision
// actée) : 591 se reporte tel quel, affecté ou non. L'exercice suivant doit EXISTER et être
// 'ouvert' — jamais automatisé, c'est un acte manuel séparé (CLI).

export interface LigneANouveaux {
  account_number: string
  name: string
  account_class: number
  side: 'D' | 'C'
  amount: number
}

export interface ApercuANouveaux {
  exercice_source: ExerciceResume
  exercice_suivant: ExerciceResume | null
  lignes: LigneANouveaux[]
  total_debit: number
  total_credit: number
  equilibre: boolean
  deja_genere: boolean
  generable: boolean
}

export interface ANouveauxResultat {
  exercice_suivant: ExerciceResume
  entry_number: string
  total: number
}

export async function previsualiserANouveaux(exerciceId: string): Promise<ApercuANouveaux> {
  const { data } = await api.get<ApercuANouveaux>(
    `/comptabilite/exercices/${exerciceId}/previsualisation-a-nouveaux`,
  )
  return data
}

export async function genererANouveaux(exerciceId: string): Promise<ANouveauxResultat> {
  const { data } = await api.post<ANouveauxResultat>(
    `/comptabilite/exercices/${exerciceId}/a-nouveaux`,
  )
  return data
}

// --- États financiers : bilan + compte de résultat (chantier P1, dernier lot) -----------------
//
// Mapping compte -> poste en base (administré séparément, voir ListerMapping/ModifierMapping
// ci-dessous). CONTRA_ACTIF vient en déduction de l'actif, jamais au passif. Un bilan pris EN
// COURS d'exercice peut légitimement ne pas s'équilibrer (le résultat de la période n'est pas
// encore entré dans les capitaux propres) — ce n'est signalé comme une anomalie qu'à l'écran,
// jamais masqué.

export type MasseEtat = 'ACTIF' | 'PASSIF' | 'CONTRA_ACTIF' | 'CHARGE' | 'PRODUIT'

export interface LignePoste {
  poste_libelle: string
  poste_ordre: number
  masse: MasseEtat
  montant: number
}

export interface CompteNonMappe {
  account_number: string
  name: string
  account_class: number
  solde: number
}

export interface Bilan {
  date: string
  actif: LignePoste[]
  passif: LignePoste[]
  total_actif_brut: number
  total_contra_actif: number
  total_actif_net: number
  total_passif: number
  ecart: number
  equilibre: boolean
  comptes_non_mappes: CompteNonMappe[]
}

export async function chargerBilan(dateParam?: string): Promise<Bilan> {
  const { data } = await api.get<Bilan>('/comptabilite/etats/bilan', {
    params: { date: dateParam || undefined },
  })
  return data
}

export interface CompteResultatEtat {
  exercice: ExerciceResume
  date_debut: string
  date_fin: string
  exercice_clos: boolean
  charges: LignePoste[]
  produits: LignePoste[]
  total_charges: number
  total_produits: number
  resultat_net: number
  source_resultat: 'periode' | 'cloture'
  comptes_non_mappes: CompteNonMappe[]
}

export async function chargerCompteResultat(exerciceId: string): Promise<CompteResultatEtat> {
  const { data } = await api.get<CompteResultatEtat>('/comptabilite/etats/compte-resultat', {
    params: { exercice_id: exerciceId },
  })
  return data
}

// --- Administration du mapping comptes -> postes (optionnel, lot c) ---------------------------

export type MasseMapping = MasseEtat | 'MIXTE'

export interface LigneMappingAdmin {
  account_id: string
  account_number: string
  name: string
  account_class: number
  etat: 'BILAN' | 'RESULTAT'
  masse: MasseMapping
  poste_libelle: string
  poste_ordre: number
  gere_manuellement: boolean
}

export async function listerMapping(): Promise<LigneMappingAdmin[]> {
  const { data } = await api.get<LigneMappingAdmin[]>('/comptabilite/etats/mapping')
  return data
}

export interface ModificationMapping {
  etat: 'BILAN' | 'RESULTAT'
  masse: MasseMapping
  poste_libelle: string
  poste_ordre: number
}

export async function modifierMapping(
  accountId: string,
  modification: ModificationMapping,
): Promise<LigneMappingAdmin> {
  const { data } = await api.patch<LigneMappingAdmin>(
    `/comptabilite/etats/mapping/${accountId}`,
    modification,
  )
  return data
}
