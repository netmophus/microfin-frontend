import { AxiosError } from 'axios'

import { api } from '@/lib/api'

/**
 * Module Tiers — liste, fiche (adaptative), création des 3 types, timeline.
 *
 * POINT CLÉ sur la fiche : le backend renvoie DEUX formes selon la permission. Un porteur de
 * tiers.read reçoit la fiche COMPLÈTE (avec un bloc individu / personne_morale / groupement) ;
 * un porteur de read.basic seul (caissier) reçoit un RÉSUMÉ, sans ces blocs. Le front ne
 * suppose donc JAMAIS leur présence — tous les champs de détail sont optionnels. Afficher ce
 * qui est là, ne pas casser quand c'est absent : c'est le cas nominal du caissier.
 */

// --- liste -----------------------------------------------------------------------------

export interface LigneTier {
  id: string
  tier_number: string
  tier_type: string
  display_name: string
  status: string
  primary_agency_id: string
}

export interface PageTiers {
  lignes: LigneTier[]
  total: number
  page: number
  taille: number
}

/** Défaut et plafond CÔTÉ SERVEUR (consultation.py) : le front s'y aligne. */
export const TAILLE_PAGE = 25

export interface ParamsListe {
  q?: string
  page?: number
}

export type EchecListe = { type: 'interdit' } | { type: 'reseau' } | { type: 'inattendue' }

export class ErreurListe extends Error {
  readonly echec: EchecListe

  constructor(echec: EchecListe) {
    super(echec.type)
    this.name = 'ErreurListe'
    this.echec = echec
  }
}

export async function listerTiers(params: ParamsListe): Promise<PageTiers> {
  try {
    const reponse = await api.get<PageTiers>('/tiers', {
      params: {
        q: params.q?.trim() || undefined,
        page: params.page ?? 1,
        taille: TAILLE_PAGE,
      },
    })
    return reponse.data
  } catch (erreur) {
    throw new ErreurListe(traduireLecture(erreur))
  }
}

// --- fiche (adaptative) + timeline -----------------------------------------------------

export interface IndividuDetail {
  last_name: string
  first_name: string
  middle_names: string | null
  name_at_birth: string | null
  birth_date: string
  birth_place: string | null
  birth_country_id: string | null
  gender: string
  nationality_id: string
  secondary_nationality_id: string | null
  marital_status: string | null
  dependents_count: number
  profession: string | null
  monthly_income_estimate: string | null
  is_literate: boolean
}

export interface PersonneMoraleDetail {
  legal_name: string
  commercial_name: string | null
  legal_form: string
  rccm_number: string | null
  nif_number: string | null
  constitution_date: string
  capital_amount: string | null
  capital_currency_id: string | null
  business_purpose: string | null
  headquarters_country_id: string
}

export interface GroupementDetail {
  group_name: string
  group_type: string
  constitution_date: string
  intervention_zone: string | null
  group_purpose: string | null
  expected_member_count: number | null
}

/**
 * Fiche renvoyée par GET /tiers/{id}. Les champs de détail sont TOUS optionnels : la vue
 * résumée (read.basic) n'en porte aucun, seulement display_name en plus des champs communs.
 */
export interface FicheTier {
  id: string
  tier_number: string
  tier_type: string
  status: string
  primary_agency_id: string
  // Présents sur la vue complète (tiers.read) :
  primary_phone?: string | null
  language_preference?: string | null
  created_at?: string
  updated_at?: string
  individu?: IndividuDetail | null
  personne_morale?: PersonneMoraleDetail | null
  groupement?: GroupementDetail | null
  // Présent sur la vue résumée (read.basic) :
  display_name?: string
}

export interface EvenementTimeline {
  occurred_at: string
  event_type: string
  previous_status: string | null
  new_status: string | null
  reason: string | null
  auteur_nom: string | null
}

export type EchecFiche = { type: 'introuvable' } | { type: 'reseau' } | { type: 'inattendue' }

export class ErreurFiche extends Error {
  readonly echec: EchecFiche

  constructor(echec: EchecFiche) {
    super(echec.type)
    this.name = 'ErreurFiche'
    this.echec = echec
  }
}

export async function lireTier(id: string): Promise<FicheTier> {
  try {
    const reponse = await api.get<FicheTier>(`/tiers/${id}`)
    return reponse.data
  } catch (erreur) {
    throw new ErreurFiche(traduireFiche(erreur))
  }
}

export async function lireTimeline(id: string): Promise<EvenementTimeline[]> {
  const reponse = await api.get<EvenementTimeline[]>(`/tiers/${id}/timeline`)
  return reponse.data
}

// --- création --------------------------------------------------------------------------

/** Communs à toute création. primary_agency_id null = « mon agence » (dérivée du claim). */
export interface CommunCreation {
  primary_phone: string | null
  primary_agency_id: string | null
}

export interface DonneesIndividu extends CommunCreation {
  last_name: string
  first_name: string
  birth_date: string
  gender: string
  nationality_id: string
  profession: string | null
}

export interface DonneesPersonneMorale extends CommunCreation {
  legal_name: string
  legal_form: string
  constitution_date: string
  headquarters_country_id: string
  capital_amount: string | null
  capital_currency_id: string | null
}

export interface DonneesGroupement extends CommunCreation {
  group_name: string
  group_type: string
  constitution_date: string
}

export type EchecCreation =
  | { type: 'conflit' }
  | { type: 'reference' } // 422 avec une FK invalide (agence/pays)
  | { type: 'invalide' }
  | { type: 'interdit' }
  | { type: 'reseau' }
  | { type: 'inattendue' }

export class ErreurCreation extends Error {
  readonly echec: EchecCreation

  constructor(echec: EchecCreation) {
    super(echec.type)
    this.name = 'ErreurCreation'
    this.echec = echec
  }
}

async function creer<T>(url: string, donnees: T): Promise<FicheTier> {
  try {
    const reponse = await api.post<FicheTier>(url, donnees)
    return reponse.data
  } catch (erreur) {
    throw new ErreurCreation(traduireCreation(erreur))
  }
}

export function creerIndividu(donnees: DonneesIndividu): Promise<FicheTier> {
  return creer('/tiers/individuals', donnees)
}

export function creerPersonneMorale(donnees: DonneesPersonneMorale): Promise<FicheTier> {
  return creer('/tiers/legal-entities', donnees)
}

export function creerGroupement(donnees: DonneesGroupement): Promise<FicheTier> {
  return creer('/tiers/groups', donnees)
}

// --- transitions de cycle de vie (T1e) -------------------------------------------------

export type TransitionNom =
  | 'activate'
  | 'suspend'
  | 'reactivate'
  | 'mark_deceased'
  | 'mark_dissolved'
  | 'deactivate'

const URL_TRANSITION: Record<TransitionNom, string> = {
  activate: 'activate',
  suspend: 'suspend',
  reactivate: 'reactivate',
  mark_deceased: 'mark-deceased',
  mark_dissolved: 'mark-dissolved',
  deactivate: 'deactivate',
}

/** Une condition d'activation non remplie, telle que le 412 la renvoie. */
export interface ConditionManquante {
  code: string
  libelle: string
}

export type EchecTransition =
  | { type: 'conditions'; conditions: ConditionManquante[] } // 412 : l'activation refusée, avec TOUT ce qui manque
  | { type: 'illegale'; message: string } // 409 : transition interdite, message du serveur
  | { type: 'introuvable' } // 404 : hors périmètre ou inexistante
  | { type: 'interdit' } // 403
  | { type: 'reseau' }
  | { type: 'inattendue' }

export class ErreurTransition extends Error {
  readonly echec: EchecTransition

  constructor(echec: EchecTransition) {
    super(echec.type)
    this.name = 'ErreurTransition'
    this.echec = echec
  }
}

export async function executerTransition(
  nom: TransitionNom,
  id: string,
  motif: string | null,
): Promise<FicheTier> {
  try {
    const corps = motif?.trim() ? { motif: motif.trim() } : {}
    const reponse = await api.post<FicheTier>(`/tiers/${id}/${URL_TRANSITION[nom]}`, corps)
    return reponse.data
  } catch (erreur) {
    throw new ErreurTransition(traduireTransition(erreur))
  }
}

function traduireTransition(erreur: unknown): EchecTransition {
  if (!(erreur instanceof AxiosError)) return { type: 'inattendue' }
  if (!erreur.response) return { type: 'reseau' }
  const reponse = erreur.response
  if (reponse.status === 412) {
    // Le backend renvoie TOUTES les conditions manquantes d'un coup : on les remonte telles quelles.
    const detail = reponse.data?.detail as { conditions_manquantes?: ConditionManquante[] } | undefined
    return { type: 'conditions', conditions: detail?.conditions_manquantes ?? [] }
  }
  if (reponse.status === 409) return { type: 'illegale', message: String(reponse.data?.detail ?? '') }
  if (reponse.status === 404) return { type: 'introuvable' }
  if (reponse.status === 403) return { type: 'interdit' }
  return { type: 'inattendue' }
}

// --- traductions d'erreurs -------------------------------------------------------------

function traduireLecture(erreur: unknown): EchecListe {
  if (!(erreur instanceof AxiosError)) return { type: 'inattendue' }
  if (!erreur.response) return { type: 'reseau' }
  if (erreur.response.status === 403) return { type: 'interdit' }
  return { type: 'inattendue' }
}

function traduireFiche(erreur: unknown): EchecFiche {
  if (!(erreur instanceof AxiosError)) return { type: 'inattendue' }
  if (!erreur.response) return { type: 'reseau' }
  // 404 couvre indistinctement « n'existe pas » et « hors de mon périmètre » (jamais 403).
  if (erreur.response.status === 404) return { type: 'introuvable' }
  return { type: 'inattendue' }
}

function traduireCreation(erreur: unknown): EchecCreation {
  if (!(erreur instanceof AxiosError)) return { type: 'inattendue' }
  if (!erreur.response) return { type: 'reseau' }
  switch (erreur.response.status) {
    case 409:
      return { type: 'conflit' }
    case 422:
      return { type: 'invalide' }
    case 403:
      return { type: 'interdit' }
    default:
      return { type: 'inattendue' }
  }
}
