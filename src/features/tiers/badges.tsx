import { Badge, type BadgeTon } from '@/components/ui/badge'
import { LIBELLES } from '@/libelles/fr'

/**
 * Correspondance métier -> ton de badge, en UN seul endroit. Chaque écran appelle ces
 * composants ; aucune couleur ni règle recopiée. Les libellés viennent de LIBELLES.
 */

const TON_STATUT: Record<string, BadgeTon> = {
  actif: 'success',
  prospect: 'warning',
  suspendu_temporaire: 'danger',
  suspendu_lcb: 'danger',
  desactive: 'neutral',
  decede: 'neutral',
  dissous: 'neutral',
  fusionne: 'neutral',
}

const TON_RISQUE: Record<string, BadgeTon> = {
  faible: 'success',
  moyen: 'warning',
  eleve: 'danger',
}

const TON_VALIDITE: Record<string, BadgeTon> = {
  valide: 'success',
  expire_bientot: 'warning',
  perimee: 'danger',
  sans_objet: 'neutral',
}

export function BadgeStatut({ code }: { code: string }) {
  return <Badge ton={TON_STATUT[code] ?? 'neutral'}>{LIBELLES.tiers.statuts[code] ?? code}</Badge>
}

/**
 * Sociétariat — dimension DISTINCTE du statut (cycle de vie). Membre = bleu institutionnel
 * (`brand`, non utilisé par les statuts, donc pas de confusion avec Actif/Suspendu) ; Client =
 * neutre (l'état par défaut, discret). Les deux badges coexistent sur une fiche : « Membre » +
 * « Actif » se lisent comme deux informations différentes.
 */
export function BadgeSocietariat({ isMember }: { isMember: boolean }) {
  return isMember ? (
    <Badge ton="brand">{LIBELLES.tiers.societariat.membre}</Badge>
  ) : (
    <Badge ton="neutral">{LIBELLES.tiers.societariat.client}</Badge>
  )
}

export function BadgeRisque({ niveau }: { niveau: string }) {
  return <Badge ton={TON_RISQUE[niveau] ?? 'neutral'}>{LIBELLES.tiersKyc.niveaux[niveau] ?? niveau}</Badge>
}

export function BadgeValidite({ etat }: { etat: string }) {
  return (
    <Badge ton={TON_VALIDITE[etat] ?? 'neutral'}>{LIBELLES.tiersPieces.validite[etat] ?? etat}</Badge>
  )
}

export function BadgePrincipal() {
  return <Badge ton="brand">{LIBELLES.tiersCoordonnees.principal}</Badge>
}

export function BadgeVerifiee() {
  return <Badge ton="success">{LIBELLES.tiersPieces.verifiee}</Badge>
}
