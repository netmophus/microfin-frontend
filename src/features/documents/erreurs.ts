import { AxiosError } from 'axios'

import { messageRefus } from '@/features/epargne/api'

/** Refus du serveur sur un téléchargement : le message métier, déjà lisible (« Ce document n'existe
 * pas… », « Le fichier est introuvable… »). */
export class ErreurServeurDocument extends Error {}

/**
 * Un téléchargement demande une réponse binaire : en cas de refus, le serveur répond pourtant en
 * JSON, que le navigateur livre alors sous forme de Blob. On le relit pour en tirer le message
 * métier ; sans lui, l'utilisateur ne verrait qu'un message générique.
 */
export async function messageDuRefusBinaire(erreur: unknown): Promise<ErreurServeurDocument | null> {
  if (!(erreur instanceof AxiosError) || !(erreur.response?.data instanceof Blob)) return null
  try {
    const detail: unknown = JSON.parse(await erreur.response.data.text()).detail
    return typeof detail === 'string' ? new ErreurServeurDocument(detail) : null
  } catch {
    // Le corps n'est pas du JSON (page d'erreur d'un mandataire…) : message générique.
    return null
  }
}

export function messageDocument(erreur: unknown, defaut: string): string {
  if (erreur instanceof ErreurServeurDocument) return erreur.message
  return messageRefus(erreur, defaut)
}
