import { useState } from 'react'

import { useAPermission } from '@/features/auth/useProfil'
import { OngletGuichetEpargne } from '@/features/epargne/OngletGuichetEpargne'
import { OngletGuichetParts } from '@/features/tiers/OngletGuichetParts'
import { LIBELLES } from '@/libelles/fr'

const G = LIBELLES.guichet

/**
 * Le guichet — poste de travail du caissier, à ONGLETS : Épargne (dépôt/retrait) et Parts
 * sociales (comptant/libération). UN SEUL écran, pas de navigation entre deux endroits pendant
 * qu'un client est devant lui — mais chaque onglet reste un composant INDÉPENDANT en interne
 * (recherche différente : numéro de compte pour l'épargne, identité du tiers pour les parts).
 * L'onglet Épargne est repris tel quel (écran déjà validé au navigateur) ; aucune fusion forcée.
 *
 * Chaque onglet n'apparaît que pour qui en a l'usage : Épargne -> epargne.operation.deposit,
 * Parts -> tiers.shares.pay. La route elle-même est ouverte dès qu'on a AU MOINS l'un des deux
 * (RoutePermission any-of) ; si un seul est détenu, l'autre onglet est simplement absent.
 */
export function PageGuichet() {
  const epargneDispo = useAPermission('epargne.operation.deposit')
  const partsDispo = useAPermission('tiers.shares.pay')
  const [onglet, setOnglet] = useState<'epargne' | 'parts'>(epargneDispo ? 'epargne' : 'parts')

  return (
    <div className="mx-auto max-w-xl space-y-4 p-4">
      <header>
        <h1 className="text-xl font-semibold">{G.titre}</h1>
      </header>

      {epargneDispo && partsDispo && (
        <div className="flex border-b" role="tablist">
          <BoutonOnglet actif={onglet === 'epargne'} onClick={() => setOnglet('epargne')}>
            {G.ongletEpargne}
          </BoutonOnglet>
          <BoutonOnglet actif={onglet === 'parts'} onClick={() => setOnglet('parts')}>
            {G.ongletParts}
          </BoutonOnglet>
        </div>
      )}

      {onglet === 'epargne' && epargneDispo && <OngletGuichetEpargne />}
      {onglet === 'parts' && partsDispo && <OngletGuichetParts />}
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
