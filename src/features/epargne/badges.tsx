import { Badge, type BadgeTon } from '@/components/ui/badge'
import { LIBELLES } from '@/libelles/fr'

/**
 * Badges du module Épargne — mêmes tokens que le reste. Compte ouvert (actif) = vert (success),
 * fermé (cloture) = gris (neutral). Le badge « provisoire » (warning) signale une valeur non
 * encore validée par l'expert (comme le barème KYC), pour qu'on ne la prenne pas pour la règle.
 */

const TON_STATUT_COMPTE: Record<string, BadgeTon> = {
  actif: 'success',
  cloture: 'neutral',
}

export function BadgeStatutCompte({ statut }: { statut: string }) {
  const E = LIBELLES.epargne
  return <Badge ton={TON_STATUT_COMPTE[statut] ?? 'neutral'}>{E.statuts[statut] ?? statut}</Badge>
}

export function BadgeProvisoire() {
  return (
    <span title={LIBELLES.epargne.provisoireAide}>
      <Badge ton="warning">{LIBELLES.epargne.provisoire}</Badge>
    </span>
  )
}
