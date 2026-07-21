import { AxiosError } from 'axios'

import { api } from '@/lib/api'

/**
 * Lecture de l'annuaire des utilisateurs — GET /users.
 *
 * Le contrat est celui du backend, vérifié dans son code : la réponse est
 * { lignes, total, page, taille }. La ligne de LISTE est volontairement pauvre (ni rôles,
 * ni téléphone) — la fiche détaillée, plus riche, viendra avec l'écran de détail.
 */

/** Agence réduite à l'affichage. */
export interface AgenceBreve {
  id: string
  code: string
  name: string
}

/** Une ligne du tableau. Reflète UtilisateurListeItem côté serveur. */
export interface LigneUtilisateur {
  id: string
  matricule: string
  username: string
  email: string
  last_name: string
  first_name: string
  agence: AgenceBreve | null
  is_active: boolean
  is_locked: boolean
}

export interface PageUtilisateurs {
  lignes: LigneUtilisateur[]
  total: number
  page: number
  taille: number
}

/** Défaut et plafond CÔTÉ SERVEUR (utilisateurs.py) : le front s'y aligne, il ne les invente pas. */
export const TAILLE_PAGE = 25

export interface ParamsListe {
  q?: string
  page?: number
}

/** Un refus de permission (403) est un cas MÉTIER distinct d'une panne : l'écran le nomme. */
export type EchecListe = { type: 'interdit' } | { type: 'reseau' } | { type: 'inattendue' }

export class ErreurListe extends Error {
  readonly echec: EchecListe

  constructor(echec: EchecListe) {
    super(echec.type)
    this.name = 'ErreurListe'
    this.echec = echec
  }
}

export async function listerUtilisateurs(params: ParamsListe): Promise<PageUtilisateurs> {
  try {
    const reponse = await api.get<PageUtilisateurs>('/users', {
      params: {
        // q vide -> omis, pour ne pas envoyer ?q= et déclencher une recherche sur le vide.
        q: params.q?.trim() || undefined,
        page: params.page ?? 1,
        taille: TAILLE_PAGE,
      },
    })
    return reponse.data
  } catch (erreur) {
    throw new ErreurListe(traduire(erreur))
  }
}

function traduire(erreur: unknown): EchecListe {
  if (!(erreur instanceof AxiosError)) return { type: 'inattendue' }
  if (!erreur.response) return { type: 'reseau' }
  // 403 : le compte n'a pas users.read. Le serveur est l'autorité ; le front nomme le refus
  // plutôt que d'afficher un tableau vide qui ressemblerait à une panne.
  if (erreur.response.status === 403) return { type: 'interdit' }
  return { type: 'inattendue' }
}

// --- création d'un utilisateur (POST /users) -----------------------------------------

/** Champs envoyés au serveur. Les noms sont ceux de CreerUtilisateurRequest côté backend. */
export interface DonneesCreation {
  matricule: string
  last_name: string
  first_name: string
  username: string
  email: string
  phone: string | null
  primary_agency_id: string
}

/** Résultat d'une création : la fiche du compte ET son mot de passe provisoire (UNE fois). */
export interface UtilisateurCree {
  utilisateur: { id: string; last_name: string; first_name: string; username: string }
  motDePasseProvisoire: string
}

export type EchecCreation =
  | { type: 'conflit' } // 409 — identifiant déjà utilisé
  | { type: 'invalide' } // 422 — donnée refusée par le serveur
  | { type: 'interdit' } // 403 — pas la permission (ne devrait pas arriver si bouton masqué)
  | { type: 'reseau' }
  | { type: 'inattendue' }

export class ErreurCreation extends Error {
  readonly echec: EchecCreation

  constructor(echec: EchecCreation) {
    super(echec.type)
    this.name = 'ErreurCreation'
    this.echec = echec
  }
}

export async function creerUtilisateur(donnees: DonneesCreation): Promise<UtilisateurCree> {
  try {
    const reponse = await api.post<{
      utilisateur: UtilisateurCree['utilisateur']
      mot_de_passe_provisoire: string
    }>('/users', donnees)
    return {
      utilisateur: reponse.data.utilisateur,
      motDePasseProvisoire: reponse.data.mot_de_passe_provisoire,
    }
  } catch (erreur) {
    throw new ErreurCreation(traduireCreation(erreur))
  }
}

function traduireCreation(erreur: unknown): EchecCreation {
  if (!(erreur instanceof AxiosError)) return { type: 'inattendue' }
  if (!erreur.response) return { type: 'reseau' }
  switch (erreur.response.status) {
    case 409:
      return { type: 'conflit' }
    case 422:
      return { type: 'invalide' }
    case 403:
      return { type: 'interdit' }
    default:
      return { type: 'inattendue' }
  }
}
