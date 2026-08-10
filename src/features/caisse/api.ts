import { AxiosError } from 'axios'

import { api } from '@/lib/api'

/**
 * Module Caisse (CA1/CA4) — session de caisse PAR CAISSIER : ouverture (fonds initial compté),
 * solde théorique en DIRECT (dérivé des écritures validées du caissier depuis l'ouverture,
 * jamais un solde stocké — miroir du rapprochement épargne), fermeture avec écart calculé et
 * figé. Aucun blocage sur la taille de l'écart : la politique de seuil/motif (CA2) n'existe
 * pas encore.
 *
 * Montants en ENTIERS de francs CFA (comme partout ailleurs). `formatFcfa` vient de l'Épargne
 * (réutilisé, pas redupliqué).
 */

export interface SessionCaisse {
  id: string
  agency_id: string
  caissier_id: string
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
}

/**
 * La session actuellement ouverte de L'ACTEUR, ou null. Null est un état NORMAL (avant la
 * première ouverture de la journée) — jamais traité comme une erreur.
 */
export async function chargerSessionCourante(): Promise<SessionCaisse | null> {
  const { data } = await api.get<SessionCaisse | null>('/caisse/sessions/courante')
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
 * Ne bloque JAMAIS, quelle que soit la taille de l'écart (CA1 : la tolérance est CA2).
 */
export async function fermerSession(sessionId: string, montantReel: number): Promise<SessionCaisse> {
  const { data } = await api.post<SessionCaisse>(`/caisse/sessions/${sessionId}/fermeture`, {
    montant_reel: montantReel,
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
