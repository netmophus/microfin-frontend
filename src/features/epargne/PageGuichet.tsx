import { useState } from 'react'

import { useAPermission } from '@/features/auth/useProfil'
import { OngletGuichetCredit } from '@/features/credit/OngletGuichetCredit'
import { OngletGuichetEpargne } from '@/features/epargne/OngletGuichetEpargne'
import { OngletGuichetParts } from '@/features/tiers/OngletGuichetParts'
import { LIBELLES } from '@/libelles/fr'

const G = LIBELLES.guichet

type Onglet = 'epargne' | 'parts' | 'credit'

/**
 * Le guichet — poste de travail du caissier, à ONGLETS : Épargne (dépôt/retrait), Parts
 * sociales (comptant/libération) et Crédit (remboursement, CR6d). UN SEUL écran, pas de
 * navigation entre plusieurs endroits pendant qu'un client est devant lui — mais chaque onglet
 * reste un composant INDÉPENDANT en interne (recherche différente pour chacun).
 *
 * Chaque onglet n'apparaît que pour qui en a l'usage : Épargne -> epargne.operation.deposit,
 * Parts -> tiers.shares.pay, Crédit -> credit.remboursement.create. La route elle-même est
 * ouverte dès qu'on a AU MOINS l'un des trois (RoutePermission any-of) ; la barre d'onglets ne
 * s'affiche que si PLUS D'UN est détenu — sinon le seul onglet disponible s'affiche seul.
 */
export function PageGuichet() {
  const epargneDispo = useAPermission('epargne.operation.deposit')
  const partsDispo = useAPermission('tiers.shares.pay')
  const creditDispo = useAPermission('credit.remboursement.create')

  const disponibles: { cle: Onglet; label: string }[] = [
    ...(epargneDispo ? [{ cle: 'epargne' as const, label: G.ongletEpargne }] : []),
    ...(partsDispo ? [{ cle: 'parts' as const, label: G.ongletParts }] : []),
    ...(creditDispo ? [{ cle: 'credit' as const, label: G.ongletCredit }] : []),
  ]
  const [onglet, setOnglet] = useState<Onglet | undefined>(disponibles[0]?.cle)

  return (
    <div className="mx-auto max-w-xl space-y-4 p-4">
      <header>
        <h1 className="text-xl font-semibold">{G.titre}</h1>
      </header>

      {disponibles.length > 1 && (
        <div className="flex border-b" role="tablist">
          {disponibles.map((o) => (
            <BoutonOnglet key={o.cle} actif={onglet === o.cle} onClick={() => setOnglet(o.cle)}>
              {o.label}
            </BoutonOnglet>
          ))}
        </div>
      )}

      {onglet === 'epargne' && epargneDispo && <OngletGuichetEpargne />}
      {onglet === 'parts' && partsDispo && <OngletGuichetParts />}
      {onglet === 'credit' && creditDispo && <OngletGuichetCredit />}
    </div>
  )
}

function BoutonOnglet({
  actif,
  onClick,
  children,
}: {
  actif: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={actif}
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
        actif
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}
