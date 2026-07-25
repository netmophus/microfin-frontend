import { AxiosError } from 'axios'

import { api } from '@/lib/api'

/**
 * Pièces d'identité d'un tiers (T2c).
 *
 * DEUX cas d'erreur portent une intention d'écran :
 *  - DOUBLON d'un numéro unique. Dans mon périmètre, le 422 NOMME la fiche (message + id +
 *    numéro + nom) → l'écran en fait un lien pour y aller en un clic. Hors périmètre, tout est
 *    nul : rien à divulguer (même principe que le 404 vs 403).
 *  - SUPPRESSION de la pièce principale s'il en reste d'autres → 409 : désigner d'abord une
 *    autre principale.
 *
 * La VALIDITÉ (valide / expire_bientot / perimee / sans_objet) est calculée par le backend à
 * chaque lecture : le front l'affiche telle quelle, il ne la recalcule pas.
 */

export type Validite = 'sans_objet' | 'valide' | 'expire_bientot' | 'perimee'

export interface Piece {
  id: string
  document_type_id: string
  document_number: string
  issuing_country_id: string | null
  issuing_authority: string | null
  date_of_issue: string | null
  expiry_date: string | null
  validite: Validite
  is_primary: boolean
  is_verified: boolean
  verified_at: string | null
  verification_notes: string | null
  notes: string | null
}

export interface TypePiece {
  id: string
  code: string
  name: string
  requires_expiry_date: boolean
}

export interface DonneesPiece {
  document_type_id: string
  document_number: string
  issuing_country_id?: string | null
  issuing_authority?: string | null
  date_of_issue?: string | null
  expiry_date?: string | null
  notes?: string | null
  is_primary: boolean
}

/** Doublon d'un numéro unique. `tierId` non nul = fiche dans mon périmètre → lien possible. */
export class ErreurDoublonPiece extends Error {
  readonly tierId: string | null
  readonly tierNumber: string | null
  readonly nom: string | null

  constructor(message: string, tierId: string | null, tierNumber: string | null, nom: string | null) {
    super(message)
    this.name = 'ErreurDoublonPiece'
    this.tierId = tierId
    this.tierNumber = tierNumber
    this.nom = nom
  }
}

export class ErreurPiece extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErreurPiece'
  }
}

export async function listerPieces(tierId: string): Promise<Piece[]> {
  const reponse = await api.get<Piece[]>(`/tiers/${tierId}/identity-documents`)
  return reponse.data
}

export async function listerTypesPieces(): Promise<TypePiece[]> {
  const reponse = await api.get<TypePiece[]>('/identity-document-types')
  return reponse.data
}

export async function ajouterPiece(tierId: string, donnees: DonneesPiece): Promise<Piece> {
  try {
    const reponse = await api.post<Piece>(`/tiers/${tierId}/identity-documents`, donnees)
    return reponse.data
  } catch (erreur) {
    if (erreur instanceof AxiosError && erreur.response?.status === 422) {
      const detail = erreur.response.data?.detail as
        | { message?: string; tier_id?: string | null; tier_number?: string | null; nom?: string | null }
        | undefined
      // Un doublon renvoie un objet {message,...} ; une erreur de validation Pydantic, une liste.
      if (detail && !Array.isArray(detail) && typeof detail === 'object' && 'message' in detail) {
        throw new ErreurDoublonPiece(
          detail.message ?? '',
          detail.tier_id ?? null,
          detail.tier_number ?? null,
          detail.nom ?? null,
        )
      }
    }
    throw erreur
  }
}

export async function definirPiecePrincipale(tierId: string, pieceId: string): Promise<Piece> {
  const reponse = await api.post<Piece>(`/tiers/${tierId}/identity-documents/${pieceId}/set-primary`)
  return reponse.data
}

export async function verifierPiece(
  tierId: string,
  pieceId: string,
  notes: string | null,
): Promise<Piece> {
  const reponse = await api.post<Piece>(`/tiers/${tierId}/identity-documents/${pieceId}/verify`, {
    notes: notes?.trim() || null,
  })
  return reponse.data
}

export async function supprimerPiece(
  tierId: string,
  pieceId: string,
  motif: string | null,
): Promise<void> {
  try {
    await api.delete(`/tiers/${tierId}/identity-documents/${pieceId}`, {
      data: motif?.trim() ? { motif: motif.trim() } : {},
    })
  } catch (erreur) {
    if (erreur instanceof AxiosError && erreur.response?.status === 409) {
      throw new ErreurPiece(String(erreur.response.data?.detail ?? ''))
    }
    throw erreur
  }
}
