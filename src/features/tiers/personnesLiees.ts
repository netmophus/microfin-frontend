import { AxiosError } from 'axios'

import { api } from '@/lib/api'

import type { PageTiers } from './api'

/**
 * Personnes liées à une société ou à un groupement (lot PM/groupements).
 *
 * Le serveur est la source de vérité : « en cours » (jugé sur la journée comptable), la somme des
 * détentions, le seuil de bénéficiaire effectif (paramètre provisoire) et le risque HÉRITÉ des
 * personnes liées arrivent tout calculés. L'écran n'en recalcule rien.
 */

export type RoleLien =
  'representant_legal' | 'dirigeant' | 'membre_bureau' | 'beneficiaire_effectif' | 'signataire'

export interface LienPersonne {
  id: string
  individual_tier_id: string
  nom: string
  tier_number: string
  statut: string
  niveau_risque: string | null
  role: RoleLien
  fonction: string | null
  pourcentage_detention: string | null
  pouvoir_signature: boolean
  date_debut: string
  date_fin: string | null
  en_cours: boolean
  atteint_le_seuil: boolean
}

export interface OrigineRisque {
  nom: string
  numero: string
  role: string
  niveau: string
}

export interface RisqueHerite {
  niveau: string | null
  explication: string
  origine: OrigineRisque | null
  provisoire: boolean
}

export interface PersonnesLiees {
  items: LienPersonne[]
  journee_reference: string
  total_beneficiaires: string
  seuil: string | null
  seuil_provisoire: boolean
  risque: RisqueHerite
}

export interface DonneesLien {
  individual_tier_id: string
  role: RoleLien
  fonction: string | null
  pourcentage_detention: string | null
  pouvoir_signature: boolean
  date_debut: string
  date_fin: string | null
}

export interface ModificationLien {
  fonction?: string | null
  pourcentage_detention?: string | null
  pouvoir_signature?: boolean
  date_debut?: string
  date_fin?: string | null
}

/** Refus d'une écriture. `detail` est le message du serveur quand il est destiné à l'écran
 *  (ex. « La somme des pourcentages de détention dépasse 100 %. »), sinon nul. */
export class ErreurLien extends Error {
  readonly detail: string | null

  constructor(detail: string | null) {
    super(detail ?? 'écriture impossible')
    this.name = 'ErreurLien'
    this.detail = detail
  }
}

function enErreurLien(erreur: unknown): ErreurLien {
  const detail =
    erreur instanceof AxiosError && erreur.response?.status === 422
      ? (erreur.response.data as { detail?: unknown } | undefined)?.detail
      : undefined
  return new ErreurLien(typeof detail === 'string' ? detail : null)
}

export async function listerPersonnesLiees(tierId: string): Promise<PersonnesLiees> {
  const reponse = await api.get<PersonnesLiees>(`/tiers/${tierId}/personnes-liees`)
  return reponse.data
}

export async function ajouterPersonneLiee(tierId: string, donnees: DonneesLien): Promise<PersonnesLiees> {
  try {
    const reponse = await api.post<PersonnesLiees>(`/tiers/${tierId}/personnes-liees`, donnees)
    return reponse.data
  } catch (erreur) {
    throw enErreurLien(erreur)
  }
}

export async function modifierPersonneLiee(
  tierId: string,
  lienId: string,
  changements: ModificationLien,
): Promise<PersonnesLiees> {
  try {
    const reponse = await api.patch<PersonnesLiees>(`/tiers/${tierId}/personnes-liees/${lienId}`, changements)
    return reponse.data
  } catch (erreur) {
    throw enErreurLien(erreur)
  }
}

export async function retirerPersonneLiee(
  tierId: string,
  lienId: string,
  motif: string,
): Promise<PersonnesLiees> {
  try {
    const reponse = await api.delete<PersonnesLiees>(`/tiers/${tierId}/personnes-liees/${lienId}`, {
      data: { motif },
    })
    return reponse.data
  } catch (erreur) {
    throw enErreurLien(erreur)
  }
}

/** Recherche de personnes PHYSIQUES dans le périmètre de l'utilisateur (nom ou numéro). */
export async function rechercherPersonnes(q: string): Promise<PageTiers['lignes']> {
  const reponse = await api.get<PageTiers>('/tiers', {
    params: { q: q.trim(), tier_type: 'individual', page: 1, taille: 10 },
  })
  return reponse.data.lignes
}
