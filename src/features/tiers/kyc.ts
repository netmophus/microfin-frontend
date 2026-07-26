import { api } from '@/lib/api'

import type { FicheTier } from './api'

/**
 * KYC d'une personne physique (T3c) — saisie des données de risque + état d'activation.
 *
 * La saisie (mettreAJourKyc) est un acte de dossier : elle exige tiers.update (chargé de
 * clientèle). Elle déclenche côté serveur le recalcul du score. L'ACTIVATION, elle, exige
 * tiers.validate (responsable/LBC) — séparation des tâches, elle vit dans actions-tier.
 */

export type ModeEntree = 'presentiel' | 'tiers_confiance' | 'distance'
export type PpeRelation = 'direct' | 'entourage'

export interface DonneesKyc {
  origine_fonds: string | null
  secteur_activite_id: string | null
  ppe_status: boolean
  ppe_relation: PpeRelation | null
  ppe_fonction: string | null
  mode_entree_relation: ModeEntree | null
}

export async function mettreAJourKyc(tierId: string, donnees: DonneesKyc): Promise<FicheTier> {
  const reponse = await api.patch<FicheTier>(`/tiers/${tierId}/kyc`, donnees)
  return reponse.data
}

/** Une condition de dossier non remplie (code technique + libellé humain). */
export interface ConditionActivation {
  code: string
  libelle: string
}

export interface ConditionsActivation {
  activable: boolean
  conditions: ConditionActivation[]
}

/** Ce qu'il reste à COMPLÉTER pour activer — pour le bandeau, avant le clic « Activer ». */
export async function lireConditionsActivation(tierId: string): Promise<ConditionsActivation> {
  const reponse = await api.get<ConditionsActivation>(`/tiers/${tierId}/activation-conditions`)
  return reponse.data
}
