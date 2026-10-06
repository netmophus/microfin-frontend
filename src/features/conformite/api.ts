import { api } from '@/lib/api'

/**
 * Ratios prudentiels (P2.1.a) — tableau de bord en LECTURE SEULE. Contrat : `GET /conformite/ratios`
 * (liste) et `GET /conformite/ratios/{code}` (détail + décomposition des agrégats).
 *
 * Les `Decimal` du backend sont sérialisés en CHAÎNES par Pydantic ; on les type donc `string`
 * et on les convertit à l'affichage seulement — aucun calcul n'est refait côté écran.
 */

export type StatutRatio = 'CONFORME' | 'NON_CONFORME' | 'NON_CALCULABLE'
export type OperateurRatio = 'GE' | 'LE'

/** Message NON BLOQUANT : il n'altère ni la valeur ni le statut, il rend un cas anormal lisible. */
export interface Avertissement {
  code: string
  libelle: string
}

export interface RatioEvalue {
  code: string
  libelle: string
  reference_reglementaire: string | null
  operateur: OperateurRatio
  seuil_applicable: string | null
  valeur_numerateur: number | null
  valeur_denominateur: number | null
  valeur_ratio_pct: string | null
  conforme: boolean | null
  marge: string | null
  statut: StatutRatio
  // false = ratio « en attente » : jamais évalué, aucune valeur numérique.
  actif: boolean
  avertissements: Avertissement[]
}

/** Enveloppe de `GET /conformite/ratios`. */
export interface TableauRatios {
  // Levé quand AUCUNE écriture validée n'existe jusqu'à la date d'arrêté (vraie base vide).
  aucune_ecriture_validee: boolean
  ratios: RatioEvalue[]
}

export interface ComposantAgregat {
  prefixe_compte: string
  sens: 1 | -1
  solde: number
  contribution: number
}

export interface DetailAgregat {
  code: string
  libelle: string
  type: 'BALANCE' | 'SPECIAL'
  valeur: number
  composants: ComposantAgregat[]
  complement_provisions_tutelle_applique: number | null
}

export interface RatioDetail extends RatioEvalue {
  agregat_numerateur: DetailAgregat
  agregat_denominateur: DetailAgregat
}

export async function chargerRatios(aLaDate: string): Promise<TableauRatios> {
  const { data } = await api.get<TableauRatios>('/conformite/ratios', {
    params: { a_la_date: aLaDate || undefined },
  })
  return data
}

export async function chargerDetailRatio(code: string, aLaDate: string): Promise<RatioDetail> {
  const { data } = await api.get<RatioDetail>(`/conformite/ratios/${encodeURIComponent(code)}`, {
    params: { a_la_date: aLaDate || undefined },
  })
  return data
}

/** « 12,5 % » à partir de la chaîne décimale du backend ; « — » si absente. */
export function formatPourcentage(valeur: string | null): string {
  if (valeur === null) return '—'
  const n = Number(valeur)
  if (!Number.isFinite(n)) return '—'
  // Espace insécable : « 200,00 » et « % » ne doivent jamais être séparés par un retour à la ligne.
  return `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\u00A0%`
}
