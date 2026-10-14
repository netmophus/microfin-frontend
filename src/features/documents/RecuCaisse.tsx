import { LigneDocument, PieceImprimable } from '@/features/documents/PieceImprimable'
import { formatFcfa } from '@/features/epargne/api'
import { montantEnLettres } from '@/lib/montantEnLettres'
import { LIBELLES } from '@/libelles/fr'

const D = LIBELLES.documents

function fmt(gabarit: string, valeurs: Record<string, string>): string {
  return gabarit.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '')
}

export interface LigneRecu {
  libelle: string
  valeur: string
}

export interface PropsRecu {
  titre: string
  /** Numéro de la pièce comptable : c'est aussi le numéro du reçu. */
  numeroPiece: string | null
  /** Journée comptable de la pièce (AAAA-MM-JJ) — jamais l'horloge. */
  dateComptable: string
  membre: string
  /** Numéro de compte (ou de dépôt) concerné. */
  compte: string
  /** Libellé du montant principal : « Montant versé », « Total remis »… */
  libelleMontant: string
  montantPrincipal: number
  lignes?: LigneRecu[]
  /** Nouveau solde, pour un versement ou un retrait. */
  soldeApres?: number | null
  /** La signature du client est exigée (retraits, dénouement) ou simplement prévue. */
  signatureClientRequise: boolean
  /** Réimpression : marque « DUPLICATA ». Désactivé par défaut (v2, hors de ce lot). */
  duplicata?: boolean
  /** Faux : le document n'est pas imprimé (deux documents sur un même écran, un seul part). */
  actif?: boolean
}

/**
 * Reçu de caisse — UN composant paramétré pour tous les reçus du guichet (versement, retrait,
 * placement / dénouement / retrait anticipé d'un dépôt à terme, parts sociales). Numéro de reçu =
 * numéro de la pièce comptable. Mise en page et impression : voir `PieceImprimable`.
 */
export function RecuCaisse({
  titre,
  numeroPiece,
  dateComptable,
  membre,
  compte,
  libelleMontant,
  montantPrincipal,
  lignes = [],
  soldeApres = null,
  signatureClientRequise,
  duplicata = false,
  actif = true,
}: PropsRecu) {
  return (
    <PieceImprimable
      nature="recu"
      titre={titre}
      reference={fmt(D.numeroRecu, { numero: numeroPiece ?? D.numeroAbsent })}
      dateComptable={dateComptable}
      signatureClientRequise={signatureClientRequise}
      duplicata={duplicata}
      actif={actif}
    >
      {({ caissier }) => (
        <>
          <dl className="space-y-1">
            <LigneDocument libelle={D.caissier} valeur={caissier} />
            <LigneDocument libelle={D.membre} valeur={membre} />
            <LigneDocument libelle={D.compte} valeur={compte} />
            {lignes.map((ligne) => (
              <LigneDocument key={ligne.libelle} libelle={ligne.libelle} valeur={ligne.valeur} />
            ))}
            <div className="flex justify-between gap-4 border-t pt-1 text-base font-semibold">
              <dt>{libelleMontant}</dt>
              <dd className="font-mono tabular-nums">{formatFcfa(montantPrincipal)}</dd>
            </div>
            {soldeApres !== null && <LigneDocument libelle={D.soldeApres} valeur={formatFcfa(soldeApres)} />}
          </dl>

          <p>{fmt(D.enLettres, { lettres: montantEnLettres(montantPrincipal) })}</p>
          <p className="text-xs">{D.mentionRecu}</p>
        </>
      )}
    </PieceImprimable>
  )
}
