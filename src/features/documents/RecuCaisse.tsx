import { nomAffiche } from '@/features/auth/profil'
import { useProfil } from '@/features/auth/useProfil'
import { EnTeteDocument } from '@/features/documents/EnTeteDocument'
import { formatFcfa } from '@/features/epargne/api'
import { cn } from '@/lib/utils'
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
 * placement / dénouement / retrait anticipé d'un dépôt à terme, parts sociales).
 *
 * Même patron d'impression que la lettre d'explication : `.zone-impression` isole le document
 * du reste de la page, il est `hidden` à l'écran et `print:block` sur le papier ; l'écran ne
 * montre que le message de succès et le bouton qui appelle `window.print()`.
 *
 * Deux exemplaires par impression (client et souche), chacun avec ses blocs de signature.
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
  const profil = useProfil().data
  const caissier = profil ? nomAffiche(profil) : '—'

  return (
    <div
      className={cn('zone-impression space-y-6', actif ? 'hidden print:block' : 'hidden')}
      data-document="recu"
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
            <p className="font-mono text-sm">
              {fmt(D.numeroRecu, { numero: numeroPiece ?? D.numeroAbsent })}
            </p>
          </div>
          <p className="text-xs font-medium uppercase tracking-wide">
            {exemplaire}
            {duplicata ? ` — ${D.duplicata}` : ''}
          </p>

          <dl className="space-y-1">
            <Ligne libelle={D.caissier} valeur={caissier} />
            <Ligne libelle={D.membre} valeur={membre} />
            <Ligne libelle={D.compte} valeur={compte} />
            {lignes.map((ligne) => (
              <Ligne key={ligne.libelle} libelle={ligne.libelle} valeur={ligne.valeur} />
            ))}
            <div className="flex justify-between gap-4 border-t pt-1 text-base font-semibold">
              <dt>{libelleMontant}</dt>
              <dd className="font-mono tabular-nums">{formatFcfa(montantPrincipal)}</dd>
            </div>
            {soldeApres !== null && <Ligne libelle={D.soldeApres} valeur={formatFcfa(soldeApres)} />}
          </dl>

          <p>{fmt(D.enLettres, { lettres: montantEnLettres(montantPrincipal) })}</p>
          <p className="text-xs">{D.mentionRecu}</p>

          <div className="grid grid-cols-2 gap-8 pt-6">
            <div>
              <p>{signatureClientRequise ? D.signatureClientObligatoire : D.signatureClientFacultative}</p>
              <div className="mt-10 border-t border-foreground" />
            </div>
            <div>
              <p>{fmt(D.signatureCaissier, { caissier })}</p>
              <div className="mt-10 border-t border-foreground" />
            </div>
          </div>
        </section>
      ))}
    </div>
  )
}

function Ligne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{libelle}</dt>
      <dd className="text-right font-medium">{valeur}</dd>
    </div>
  )
}
