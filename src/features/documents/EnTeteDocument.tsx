import { useProfil } from '@/features/auth/useProfil'
import { formatJour } from '@/features/epargne/api'
import { LIBELLES } from '@/libelles/fr'

const D = LIBELLES.documents

function fmt(gabarit: string, valeurs: Record<string, string>): string {
  return gabarit.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '')
}

/**
 * En-tête commun des pièces justificatives : institution (config du déploiement, via /auth/me),
 * agence de l'acteur et JOURNÉE COMPTABLE de l'opération — fournie par l'appelant (date de la
 * pièce), jamais lue sur l'horloge du poste. Tant que le nom de l'institution n'est pas
 * configuré, un bandeau « provisoire » le dit sur le document lui-même : on n'invente pas un nom.
 */
export function EnTeteDocument({ dateComptable }: { dateComptable: string }) {
  const profil = useProfil().data
  const institution = profil?.institution
  const agence = profil?.agence_courante
  const configuree = Boolean(institution?.nom)

  return (
    <header className="space-y-1">
      {!configuree && (
        <p className="rounded border border-dashed px-2 py-1 text-xs font-medium">{D.bandeauProvisoire}</p>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{configuree ? institution?.nom : D.institutionAbsente}</h2>
          {institution?.adresse && <p className="text-xs">{institution.adresse}</p>}
          {institution?.telephone && (
            <p className="text-xs">{fmt(D.telephone, { telephone: institution.telephone })}</p>
          )}
          {institution?.numero_agrement && (
            <p className="text-xs">{fmt(D.agrement, { numero: institution.numero_agrement })}</p>
          )}
        </div>
        <div className="text-right text-sm">
          {agence && <p>{fmt(D.agence, { agence: `${agence.name} (${agence.code})` })}</p>}
          <p className="font-medium">{fmt(D.journeeComptable, { date: formatJour(dateComptable) })}</p>
        </div>
      </div>
    </header>
  )
}
