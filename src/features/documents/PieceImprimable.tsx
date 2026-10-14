import type { ReactNode } from 'react'

import { nomAffiche } from '@/features/auth/profil'
import { useProfil } from '@/features/auth/useProfil'
import { EnTeteDocument } from '@/features/documents/EnTeteDocument'
import { cn } from '@/lib/utils'
import { LIBELLES } from '@/libelles/fr'

const D = LIBELLES.documents

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
 * `hidden` à l'écran et `print:block` sur le papier. DEUX exemplaires par impression (client et
 * souche), chacun avec l'en-tête institution, le titre, le corps et les blocs de signature.
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

  return (
    <div
      className={cn('zone-impression space-y-6', actif ? 'hidden print:block' : 'hidden')}
      data-document={nature}
    >
      {[D.exemplaireClient, D.exemplaireSouche].map((exemplaire, rang) => (
        <section
          key={exemplaire}
          className={cn(
            'space-y-3 text-sm print:break-inside-avoid',
            rang === 0 && 'border-b border-dashed pb-6',
          )}
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

          <div className="grid grid-cols-2 gap-8 pt-6">
            <div>
              <p>{signatureClientRequise ? D.signatureClientObligatoire : D.signatureClientFacultative}</p>
              <div className="mt-10 border-t border-foreground" />
            </div>
            <div>
              <p>{D.signatureCaissier}</p>
              <div className="mt-10 border-t border-foreground" />
            </div>
          </div>
        </section>
      ))}
    </div>
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
