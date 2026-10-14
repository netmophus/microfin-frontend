import { Fragment, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { nomAffiche } from '@/features/auth/profil'
import { useProfil } from '@/features/auth/useProfil'
import { EnTeteDocument } from '@/features/documents/EnTeteDocument'
import { cn } from '@/lib/utils'
import { LIBELLES } from '@/libelles/fr'

const D = LIBELLES.documents

/** Classe posée sur <html> tant qu'une pièce est imprimable : l'application est alors retirée de
 * la mise en page à l'impression (voir index.css), pour qu'il ne reste que la pièce sur le papier. */
const CLASSE_IMPRESSION_PIECE = 'impression-piece'

export interface PropsPieceImprimable {
  /** « recu » ou « bon » : repère le document (impression, tests). */
  nature: 'recu' | 'bon'
  titre: string
  /** Référence affichée à droite du titre (n° de reçu, n° de bon). */
  reference: string
  /** Journée comptable de la pièce (AAAA-MM-JJ) — jamais l'horloge. */
  dateComptable: string
  /** La signature du client est exigée, ou simplement prévue. */
  signatureClientRequise: boolean
  /** Réimpression : marque « DUPLICATA ». Désactivé par défaut (v2). */
  duplicata?: boolean
  /** Faux : le document n'est pas imprimé (deux documents sur un même écran, un seul part). */
  actif?: boolean
  /** Corps du document, rendu une fois par exemplaire. `caissier` : l'acteur connecté. */
  children: (contexte: { caissier: string }) => ReactNode
}

/**
 * Socle commun des pièces imprimables (reçus de caisse, bon de dépôt à terme) : même patron que
 * la lettre d'explication — `.zone-impression` isole le document du reste de la page, il est
 * `hidden` à l'écran et `print:block` sur le papier.
 *
 * DEUX exemplaires (client et souche) sur UNE A4, séparés par un trait de découpe visible
 * seulement à l'impression (ni avant le premier, ni après le second). Le document est monté dans
 * un portail sous <body> : en flux normal et hors de l'application, il ne laisse aucune hauteur
 * résiduelle — donc aucune page blanche. Espacements et corps de texte sont resserrés au
 * papier pour que chaque exemplaire tienne dans la moitié de la hauteur imprimable.
 */
export function PieceImprimable({
  nature,
  titre,
  reference,
  dateComptable,
  signatureClientRequise,
  duplicata = false,
  actif = true,
  children,
}: PropsPieceImprimable) {
  const profil = useProfil().data
  const caissier = profil ? nomAffiche(profil) : '—'

  useEffect(() => {
    if (!actif) return undefined
    const racine = document.documentElement
    racine.classList.add(CLASSE_IMPRESSION_PIECE)
    return () => racine.classList.remove(CLASSE_IMPRESSION_PIECE)
  }, [actif])

  return createPortal(
    <div
      className={cn('zone-impression piece-imprimable', actif ? 'hidden print:block' : 'hidden')}
      data-document={nature}
    >
      {[D.exemplaireClient, D.exemplaireSouche].map((exemplaire, rang) => (
        <Fragment key={exemplaire}>
          {rang === 1 && (
            <div
              data-testid="trait-decoupe"
              className="hidden border-t border-dashed border-foreground py-1 text-center text-xs print:block"
            >
              {D.decouperIci}
            </div>
          )}
          <section
            className="exemplaire space-y-2 text-sm print:space-y-1.5 print:break-inside-avoid print:text-[10pt]"
            aria-label={exemplaire}
          >
            <EnTeteDocument dateComptable={dateComptable} />

            <div className="flex items-baseline justify-between gap-4">
              <h3 className="text-base font-semibold">{titre}</h3>
              <p className="font-mono text-sm">{reference}</p>
            </div>
            <p className="text-xs font-medium uppercase tracking-wide">
              {exemplaire}
              {duplicata ? ` — ${D.duplicata}` : ''}
            </p>

            {children({ caissier })}

            <div className="grid grid-cols-2 gap-8 pt-3 print:pt-2">
              <div>
                <p>{signatureClientRequise ? D.signatureClientObligatoire : D.signatureClientFacultative}</p>
                <div className="mt-8 border-t border-foreground print:mt-6" />
              </div>
              <div>
                <p>{D.signatureCaissier}</p>
                <div className="mt-8 border-t border-foreground print:mt-6" />
              </div>
            </div>
          </section>
        </Fragment>
      ))}
    </div>,
    document.body,
  )
}

export function LigneDocument({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{libelle}</dt>
      <dd className="text-right font-medium">{valeur}</dd>
    </div>
  )
}
