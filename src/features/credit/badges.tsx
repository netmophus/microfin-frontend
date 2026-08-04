import { Badge, type BadgeTon } from '@/components/ui/badge'
import { LIBELLES } from '@/libelles/fr'

/**
 * Badge de statut d'un dossier de crédit. En instruction = en attente (warning), approuvée =
 * succès, refusée = danger, décaissée = brand (plus loin dans le cycle, pas un aboutissement
 * neutre — de l'argent est sorti).
 */
const TON_STATUT_DOSSIER: Record<string, BadgeTon> = {
  en_instruction: 'warning',
  approuve: 'success',
  refuse: 'danger',
  decaisse: 'brand',
}

export function BadgeStatutDossier({ statut }: { statut: string }) {
  const C = LIBELLES.credit
  return <Badge ton={TON_STATUT_DOSSIER[statut] ?? 'neutral'}>{C.statuts[statut] ?? statut}</Badge>
}
