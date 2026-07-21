import { Button } from '@/components/ui/button'
import { LIBELLES } from '@/libelles/fr'

/**
 * Panneau de confirmation d'une action sensible. In situ, pas une boîte native window.confirm
 * — celle-ci est un « OK » réflexe qu'on clique sans lire. Ici l'avertissement est affiché en
 * toutes lettres, et l'action de confirmation porte un libellé explicite (« Supprimer
 * définitivement », pas « OK »).
 *
 * `danger` teinte le bouton en destructif pour les actions peu réversibles (suppression).
 */
export function Confirmation({
  titre,
  avertissement,
  libelleConfirmer,
  danger = false,
  enCours = false,
  onConfirmer,
  onAnnuler,
}: {
  titre: string
  avertissement: string
  libelleConfirmer: string
  danger?: boolean
  enCours?: boolean
  onConfirmer: () => void
  onAnnuler: () => void
}) {
  return (
    <div
      role="alertdialog"
      aria-label={titre}
      className={
        danger
          ? 'space-y-3 rounded-lg border-2 border-destructive/40 bg-destructive/5 p-4'
          : 'space-y-3 rounded-lg border-2 border-amber-300 bg-amber-50 p-4'
      }
    >
      <h3 className="font-semibold">{titre}</h3>
      <p className="text-sm">{avertissement}</p>
      <div className="flex gap-3">
        <Button
          type="button"
          variant={danger ? 'destructive' : 'default'}
          disabled={enCours}
          onClick={onConfirmer}
        >
          {libelleConfirmer}
        </Button>
        <Button type="button" variant="outline" disabled={enCours} onClick={onAnnuler}>
          {LIBELLES.fiche.annuler}
        </Button>
      </div>
    </div>
  )
}
