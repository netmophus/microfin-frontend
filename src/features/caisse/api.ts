import { AxiosError } from 'axios'

import { api } from '@/lib/api'

/**
 * Module Caisse (CA1/CA4) — session de caisse PAR CAISSIER : ouverture (fonds initial compté),
 * solde théorique en DIRECT (dérivé des écritures validées du caissier depuis l'ouverture,
 * jamais un solde stocké — miroir du rapprochement épargne), fermeture avec écart calculé et
 * figé.
 *
 * CA2 : seuil de tolérance paramétrable (compte plan-comptable), motif OBLIGATOIRE au-delà —
 * ne bloque JAMAIS la fermeture, juste l'exige. `a_valider` est DÉRIVÉ côté serveur (fermée +
 * écart au-delà du seuil + non validée), jamais stocké — ne pas le recalculer ici.
 *
 * Montants en ENTIERS de francs CFA (comme partout ailleurs). `formatFcfa` vient de l'Épargne
 * (réutilisé, pas redupliqué).
 */

export interface SessionCaisse {
  id: string
  agency_id: string
  agency_nom: string
  caissier_id: string
  caissier_nom: string
  compte_caisse_number: string
  fonds_initial: number
  opened_at: string
  closed_at: string | null
  // EN DIRECT (recalculé à chaque lecture) tant que la session est ouverte ; null une fois
  // fermée — le chiffre figé est solde_theorique_cloture, pas la peine de répéter le même
  // nombre sous deux noms.
  solde_theorique_actuel: number | null
  montant_reel_cloture: number | null
  solde_theorique_cloture: number | null
  ecart: number | null
  status: 'ouverte' | 'fermee'
  motif_ecart: string | null
  valide_le: string | null
  valide_par_nom: string | null
  a_valider: boolean
}

/**
 * La session actuellement ouverte de L'ACTEUR, ou null. Null est un état NORMAL (avant la
 * première ouverture de la journée) — jamais traité comme une erreur.
 */
export async function chargerSessionCourante(): Promise<SessionCaisse | null> {
  const { data } = await api.get<SessionCaisse | null>('/caisse/sessions/courante')
  return data
}

/**
 * Lit UNE session par id — la sienne toujours ; celle d'un autre caissier seulement avec
 * caisse.session.read.autres ET dans le périmètre (contrôlé côté serveur, jamais ici). Sert la
 * lettre de demande d'explication : source unique de vérité, régénérable/réimprimable à tout
 * moment sans rien stocker de plus (CaisseSession porte déjà tout le nécessaire).
 */
export async function lireSession(sessionId: string): Promise<SessionCaisse> {
  const { data } = await api.get<SessionCaisse>(`/caisse/sessions/${sessionId}`)
  return data
}

/** Ouvre une session pour L'ACTEUR — `fonds_initial` compté PHYSIQUEMENT à la prise de poste. */
export async function ouvrirSession(fondsInitial: number): Promise<SessionCaisse> {
  const { data } = await api.post<SessionCaisse>('/caisse/sessions', {
    fonds_initial: fondsInitial,
  })
  return data
}

/**
 * Ferme la session de L'ACTEUR — calcule et FIGE l'écart (montant compté - solde théorique).
 * Ne bloque JAMAIS, quelle que soit la taille de l'écart (CA2 : un motif est EXIGÉ au-delà du
 * seuil de tolérance — 422 si absent, jamais un refus de fermer).
 */
export async function fermerSession(
  sessionId: string,
  montantReel: number,
  motif?: string,
): Promise<SessionCaisse> {
  const { data } = await api.post<SessionCaisse>(`/caisse/sessions/${sessionId}/fermeture`, {
    montant_reel: montantReel,
    motif: motif ?? null,
  })
  return data
}

// --- Manquants (retrouver une lettre de demande d'explication plus tard) -------------------

export interface LigneSessionManquante {
  id: string
  caissier_id: string
  caissier_nom: string
  agency_id: string
  agency_nom: string
  compte_caisse_number: string
  fonds_initial: number
  opened_at: string
  closed_at: string
  montant_reel_cloture: number
  solde_theorique_cloture: number
  ecart: number
}

export interface PageSessionsManquantes {
  lignes: LigneSessionManquante[]
  total: number
  page: number
  taille: number
}

/**
 * Sessions fermées avec un MANQUANT (écart < 0) : les SIENNES pour un caissier, plus celles de
 * son périmètre s'il détient caisse.session.read.autres (responsable : son agence ; audit/
 * direction : tout le réseau) — contrôlé côté serveur. C'est ce qui permet de retrouver une
 * lettre plus tard sans dépendre d'un lien reçu au moment de la fermeture.
 */
export async function listerSessionsManquantes(
  page = 1,
  taille = 25,
): Promise<PageSessionsManquantes> {
  const { data } = await api.get<PageSessionsManquantes>('/caisse/sessions', {
    params: { manquant: true, page, taille },
  })
  return data
}

/** Message d'un refus (session déjà ouverte, agence sans compte de caisse rattaché…). */
export function messageRefusCaisse(erreur: unknown, defaut: string): string {
  if (erreur instanceof AxiosError) {
    const detail = erreur.response?.data?.detail
    if (typeof detail === 'string') return detail
  }
  return defaut
}

// --- Paramètres (CA2) : seuil de tolérance, singleton PROVISOIRE, comme les parts sociales --

export interface ParametresCaisse {
  seuil_tolerance: number
  is_provisional: boolean
}

export async function lireParametresCaisse(): Promise<ParametresCaisse> {
  const { data } = await api.get<ParametresCaisse>('/caisse/parametres')
  return data
}

export async function modifierParametresCaisse(
  seuilTolerance: number,
  motif: string,
): Promise<ParametresCaisse> {
  const { data } = await api.put<ParametresCaisse>('/caisse/parametres', {
    seuil_tolerance: seuilTolerance,
    motif,
  })
  return data
}

// --- Sessions à valider (CA2) : file d'attente du responsable, statut DÉRIVÉ côté serveur ----

export interface LigneSessionAValider {
  id: string
  caissier_id: string
  caissier_nom: string
  agency_id: string
  agency_nom: string
  compte_caisse_number: string
  fonds_initial: number
  opened_at: string
  closed_at: string
  montant_reel_cloture: number
  solde_theorique_cloture: number
  ecart: number
  motif_ecart: string | null
}

export interface PageSessionsAValider {
  lignes: LigneSessionAValider[]
  total: number
  page: number
  taille: number
  seuil_tolerance: number
}

/**
 * Sessions fermées avec un écart au-delà du seuil de tolérance, pas encore validées : les
 * SIENNES pour un caissier, plus celles de son périmètre s'il détient caisse.session.read.autres
 * (contrôlé côté serveur). Une session validée disparaît immédiatement de cette liste — c'est
 * un calcul dérivé, jamais un statut stocké à rafraîchir manuellement.
 */
export async function listerSessionsAValider(
  page = 1,
  taille = 25,
): Promise<PageSessionsAValider> {
  const { data } = await api.get<PageSessionsAValider>('/caisse/sessions-a-valider', {
    params: { page, taille },
  })
  return data
}

/**
 * Validation A POSTERIORI de l'écart par le responsable — une TRACE consultable, jamais un
 * blocage : ne change rien d'autre que la date/l'auteur de validation.
 */
export async function validerEcart(sessionId: string): Promise<SessionCaisse> {
  const { data } = await api.post<SessionCaisse>(
    `/caisse/sessions/${sessionId}/validation-ecart`,
  )
  return data
}

// --- Postes de caisse (Bloc B) ---------------------------------------------------------------
// CRUD (création/renommage/(dés)activation/assignation) : caisse.poste.manage, SON agence.
// Rattachement comptable : compta.plan.manage (existant), institution entière.

export interface PosteCaisse {
  id: string
  agency_id: string
  agency_nom: string
  code: string
  libelle: string
  compte_caisse_number: string | null
  compte_caisse_name: string | null
  is_active: boolean
}

export async function listerPostes(): Promise<PosteCaisse[]> {
  const { data } = await api.get<PosteCaisse[]>('/caisse/postes')
  return data
}

export async function creerPoste(
  code: string,
  libelle: string,
  motif: string,
): Promise<PosteCaisse> {
  const { data } = await api.post<PosteCaisse>('/caisse/postes', { code, libelle, motif })
  return data
}

export async function renommerPoste(
  id: string,
  code: string,
  libelle: string,
  motif: string,
): Promise<PosteCaisse> {
  const { data } = await api.patch<PosteCaisse>(`/caisse/postes/${id}`, { code, libelle, motif })
  return data
}

export async function changerActivationPoste(
  id: string,
  isActive: boolean,
  motif: string,
): Promise<PosteCaisse> {
  const { data } = await api.patch<PosteCaisse>(`/caisse/postes/${id}/activation`, {
    is_active: isActive,
    motif,
  })
  return data
}

export async function rattacherComptePoste(
  id: string,
  compteCaisse: string | null,
  motif: string,
): Promise<PosteCaisse> {
  const { data } = await api.patch<PosteCaisse>(`/caisse/postes/${id}/compte-caisse`, {
    compte_caisse: compteCaisse,
    motif,
  })
  return data
}

export interface UtilisateurAssigne {
  id: string
  matricule: string
  username: string
  nom_complet: string
}

export async function listerAssignations(posteId: string): Promise<UtilisateurAssigne[]> {
  const { data } = await api.get<UtilisateurAssigne[]>(`/caisse/postes/${posteId}/assignations`)
  return data
}

export async function assignerGuichetier(
  posteId: string,
  userId: string,
): Promise<UtilisateurAssigne[]> {
  const { data } = await api.post<UtilisateurAssigne[]>(
    `/caisse/postes/${posteId}/assignations`,
    { user_id: userId },
  )
  return data
}

export async function revoquerAssignation(posteId: string, userId: string): Promise<void> {
  await api.delete(`/caisse/postes/${posteId}/assignations/${userId}`)
}
