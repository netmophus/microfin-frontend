import { LigneDocument, PieceImprimable } from '@/features/documents/PieceImprimable'
import { formatFcfa, formatJour, formatTaux } from '@/features/epargne/api'
import { montantEnLettres } from '@/lib/montantEnLettres'
import { LIBELLES } from '@/libelles/fr'

const D = LIBELLES.documents

function fmt(gabarit: string, valeurs: Record<string, string>): string {
  return gabarit.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '')
}

export interface PropsCertificatDepotATerme {
  /** Numéro du dépôt à terme : c'est le numéro du bon. */
  numeroCompte: string
  membre: string
  capital: number
  /** Journée comptable du placement (AAAA-MM-JJ) : le départ du terme. */
  depart: string
  echeance: string
  dureeMois: number
  /** Taux annuel figé au contrat, en points de base. */
  tauxBp: number
  interetsAttendus: number
  /** Pénalité de retrait anticipé figée au contrat, en points de base des intérêts courus. */
  penaliteBp: number
  duplicata?: boolean
  actif?: boolean
}

/**
 * Bon (certificat) de dépôt à terme — le CONTRAT remis au client : capital, départ, échéance,
 * durée, taux, intérêts attendus, pénalité et clause de retrait anticipé. Toutes les valeurs sont
 * celles figées au contrat du compte, jamais celles, modifiables, du produit. Distinct d'un reçu :
 * il porte le numéro du dépôt, et la signature du client y est OBLIGATOIRE. Même socle d'impression
 * que les reçus (`PieceImprimable`) : deux exemplaires, masqué à l'écran.
 */
export function CertificatDepotATerme({
  numeroCompte,
  membre,
  capital,
  depart,
  echeance,
  dureeMois,
  tauxBp,
  interetsAttendus,
  penaliteBp,
  duplicata = false,
  actif = true,
}: PropsCertificatDepotATerme) {
  return (
    <PieceImprimable
      nature="bon"
      titre={D.titreBon}
      reference={fmt(D.numeroBon, { numero: numeroCompte })}
      dateComptable={depart}
      signatureClientRequise
      duplicata={duplicata}
      actif={actif}
    >
      {({ caissier }) => (
        <>
          <dl className="space-y-1">
            <LigneDocument libelle={D.caissier} valeur={caissier} />
            <LigneDocument libelle={D.titulaire} valeur={membre} />
            <LigneDocument libelle={D.compte} valeur={numeroCompte} />
            <LigneDocument libelle={D.depart} valeur={formatJour(depart)} />
            <LigneDocument libelle={D.echeance} valeur={formatJour(echeance)} />
            <LigneDocument libelle={D.duree} valeur={fmt(D.dureeValeur, { mois: String(dureeMois) })} />
            <LigneDocument libelle={D.tauxAnnuel} valeur={formatTaux(tauxBp)} />
            <LigneDocument libelle={D.interetsAttendus} valeur={formatFcfa(interetsAttendus)} />
            <LigneDocument
              libelle={D.penalite}
              valeur={fmt(D.penaliteValeur, { pourcent: formatTaux(penaliteBp) })}
            />
            <div className="flex justify-between gap-4 border-t pt-1 text-base font-semibold">
              <dt>{D.capitalPlace}</dt>
              <dd className="font-mono tabular-nums">{formatFcfa(capital)}</dd>
            </div>
          </dl>

          <p>{fmt(D.enLettres, { lettres: montantEnLettres(capital) })}</p>
          <p className="text-xs">{D.clauseEcheance}</p>
          <p className="text-xs">{fmt(D.clauseRetraitAnticipe, { pourcent: formatTaux(penaliteBp) })}</p>
          <p className="text-xs">{D.mentionBon}</p>
        </>
      )}
    </PieceImprimable>
  )
}
