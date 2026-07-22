import { AxiosError } from 'axios'

import { api } from '@/lib/api'

/**
 * Consultation du journal d'audit — GET /audit (lecture seule).
 *
 * Le backend renvoie le CODE d'action brut (user.created…) ; c'est l'écran qui le traduit en
 * français via la table de correspondance des libellés. Ici on ne fait que transporter.
 */

/** Une entrée du journal, telle que GET /audit la renvoie. */
export interface LigneAudit {
  id: string
  occurred_at: string
  action: string
  acteur_id: string | null
  acteur_nom: string | null
  resource_type: string | null
  cible_id: string | null
  cible_nom: string | null
  ip_address: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
}

export interface PageAudit {
  lignes: LigneAudit[]
  total: number
  page: number
  taille: number
}

export const TAILLE_PAGE = 25

export interface FiltresAudit {
  action?: string
  dateDebut?: string
  dateFin?: string
  page?: number
}

export type EchecAudit = { type: 'interdit' } | { type: 'reseau' } | { type: 'inattendue' }

export class ErreurAudit extends Error {
  readonly echec: EchecAudit

  constructor(echec: EchecAudit) {
    super(echec.type)
    this.name = 'ErreurAudit'
    this.echec = echec
  }
}

export async function listerAudit(filtres: FiltresAudit): Promise<PageAudit> {
  try {
    const reponse = await api.get<PageAudit>('/audit', {
      params: {
        action: filtres.action || undefined,
        // Une date « depuis le J » couvre le jour entier ; « jusqu'au J » doit INCLURE ce
        // jour, donc on borne la fin au lendemain (le backend traite date_fin comme exclue).
        date_debut: filtres.dateDebut ? `${filtres.dateDebut}T00:00:00` : undefined,
        date_fin: filtres.dateFin ? `${filtres.dateFin}T23:59:59` : undefined,
        page: filtres.page ?? 1,
        taille: TAILLE_PAGE,
      },
    })
    return reponse.data
  } catch (erreur) {
    throw new ErreurAudit(traduire(erreur))
  }
}

function traduire(erreur: unknown): EchecAudit {
  if (!(erreur instanceof AxiosError)) return { type: 'inattendue' }
  if (!erreur.response) return { type: 'reseau' }
  if (erreur.response.status === 403) return { type: 'interdit' }
  return { type: 'inattendue' }
}
