import { messageDuRefusBinaire } from '@/features/documents/erreurs'
import { api } from '@/lib/api'

/**
 * Documents archivés par le serveur (PDF/A) : référence jointe au résultat d'une opération,
 * téléchargement et régénération. Le PDF est celui du serveur — le navigateur ne le fabrique pas,
 * il l'affiche ou l'imprime.
 */

/** Référence d'un document, jointe au résultat d'une opération. `echec` : l'opération est bien
 * enregistrée mais le document n'a pas pu être généré — il se régénère. */
export interface DocumentRef {
  id: string
  nom: string
  statut: 'ok' | 'echec'
}

/** Une ligne de la liste des documents archivés. */
export interface DocumentResume {
  id: string
  type: string
  module: string
  journee_comptable: string // AAAA-MM-JJ : la journée comptable, jamais l'horloge
  nom_fichier: string
  numero_piece: string | null
  statut: 'ok' | 'echec'
  erreur: string | null
}

export interface PageDocuments {
  lignes: DocumentResume[]
  total: number
  page: number
  taille: number
}

export interface FiltresDocuments {
  journee?: string
  module?: string
  type?: string
}

/** Segment d'URL de l'état comptable à demander en brouillon (journée ouverte). */
export type EtatBrouillon = 'journal-du-jour' | 'balance-du-jour'

/** Délai avant de libérer l'URL temporaire du PDF : l'onglet de visualisation doit pouvoir la lire. */
const DELAI_LIBERATION_URL_MS = 60_000

/** Le PDF archivé — passe par `api` (jeton + cookie) : un lien direct n'aurait porté ni l'un ni
 * l'autre. Les droits sont vérifiés par le serveur (permission, agence, et propriétaire pour un
 * caissier). */
export async function telechargerDocument(id: string): Promise<Blob> {
  return obtenirPdf(`/documents/${id}/fichier`)
}

async function obtenirPdf(url: string): Promise<Blob> {
  try {
    const { data } = await api.get<Blob>(url, { responseType: 'blob' })
    return data
  } catch (erreur) {
    throw (await messageDuRefusBinaire(erreur)) ?? erreur
  }
}

/** Les documents du périmètre de l'acteur, filtrés et paginés CÔTÉ SERVEUR. */
export async function listerDocuments(
  filtres: FiltresDocuments,
  page: number,
  taille: number,
): Promise<PageDocuments> {
  const { data } = await api.get<PageDocuments>('/documents', {
    params: {
      journee: filtres.journee || undefined,
      module: filtres.module || undefined,
      type: filtres.type || undefined,
      page,
      taille,
    },
  })
  return data
}

/** Brouillon (jamais archivé) du journal ou de la balance de la journée OUVERTE. */
export async function telechargerBrouillon(etat: EtatBrouillon): Promise<Blob> {
  return obtenirPdf(`/documents/etats/${etat}/brouillon`)
}

/** Rattrape un document dont la génération a échoué (idempotent côté serveur). */
export async function regenererDocument(id: string): Promise<DocumentRef> {
  const { data } = await api.post<{ id: string; nom_fichier: string; statut: 'ok' | 'echec' }>(
    `/documents/${id}/regenerer`,
  )
  return { id: data.id, nom: data.nom_fichier, statut: data.statut }
}

/**
 * Ouvre le PDF pour l'imprimer ou l'enregistrer (le lecteur PDF du navigateur propose les deux).
 * Si le navigateur bloque l'ouverture d'un onglet, le fichier est téléchargé à la place : le
 * document n'est jamais perdu.
 */
export function ouvrirPdf(pdf: Blob, nom: string): void {
  const url = window.URL.createObjectURL(pdf)
  const fenetre = window.open(url, '_blank')
  if (!fenetre) {
    const lien = document.createElement('a')
    lien.href = url
    lien.download = nom
    document.body.appendChild(lien)
    lien.click()
    document.body.removeChild(lien)
  }
  window.setTimeout(() => window.URL.revokeObjectURL(url), DELAI_LIBERATION_URL_MS)
}
