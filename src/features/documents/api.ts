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

/** Délai avant de libérer l'URL temporaire du PDF : l'onglet de visualisation doit pouvoir la lire. */
const DELAI_LIBERATION_URL_MS = 60_000

/** Le PDF archivé — passe par `api` (jeton + cookie) : un lien direct n'aurait porté ni l'un ni
 * l'autre. Les droits sont vérifiés par le serveur (permission, agence, et propriétaire pour un
 * caissier). */
export async function telechargerDocument(id: string): Promise<Blob> {
  const { data } = await api.get<Blob>(`/documents/${id}/fichier`, { responseType: 'blob' })
  return data
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
