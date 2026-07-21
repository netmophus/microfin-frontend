import { api } from '@/lib/api'

/** Une agence, telle que GET /agencies la renvoie — de quoi peupler un sélecteur. */
export interface Agence {
  id: string
  code: string
  name: string
}

export async function listerAgences(): Promise<Agence[]> {
  const reponse = await api.get<Agence[]>('/agencies')
  return reponse.data
}
