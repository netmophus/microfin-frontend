import { Badge } from '@/components/ui/badge'
import { LIBELLES } from '@/libelles/fr'

const T = LIBELLES.utilisateurs

/**
 * Statut d'un compte utilisateur — réutilise le composant Badge UNIQUE (pas de couleur recopiée).
 * Le cas le plus urgent l'emporte : verrouillé (danger) prime sur inactif (neutral), sinon actif.
 * Signature structurelle (is_active/is_locked) : sert à la liste comme à la fiche.
 */
export function BadgeStatutUtilisateur({
  ligne,
}: {
  ligne: { is_active: boolean; is_locked: boolean }
}) {
  if (ligne.is_locked) return <Badge ton="danger">{T.verrouille}</Badge>
  if (!ligne.is_active) return <Badge ton="neutral">{T.inactif}</Badge>
  return <Badge ton="success">{T.actif}</Badge>
}
