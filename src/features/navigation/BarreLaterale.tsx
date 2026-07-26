import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'

import { menuVisible, type EntreeMenu, type GroupeMenu } from '@/features/navigation/menu'
import { LIBELLES } from '@/libelles/fr'
import { cn } from '@/lib/utils'

/**
 * Arborescence de navigation verticale (esprit Amplitude) : des groupes dépliables, visibles
 * en permanence, l'entrée active mise en évidence.
 *
 * L'état déplié/replié est un useState LOCAL. Il survit à la navigation parce que la barre
 * vit dans AppLayout, une route de mise en page que le changement de page ne démonte pas —
 * déplier un groupe puis ouvrir une fiche ne le referme donc pas. Par défaut tout est
 * ouvert : un client doit voir d'emblée l'étendue du produit, y compris ce qui reste à venir.
 */
export function BarreLaterale({ permissions }: { permissions: readonly string[] }) {
  const groupes = menuVisible(permissions)

  return (
    <nav aria-label="Navigation principale" className="w-64 shrink-0 border-r bg-background">
      <div className="flex h-full flex-col gap-1 overflow-y-auto p-2">
        {groupes.map((groupe) => (
          <Groupe key={groupe.id} groupe={groupe} />
        ))}
      </div>
    </nav>
  )
}

function Groupe({ groupe }: { groupe: GroupeMenu }) {
  const [ouvert, setOuvert] = useState(true)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className="flex w-full items-center gap-1 rounded px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted"
      >
        {ouvert ? (
          <ChevronDown className="size-3.5 shrink-0" aria-hidden />
        ) : (
          <ChevronRight className="size-3.5 shrink-0" aria-hidden />
        )}
        {groupe.titre}
      </button>

      {ouvert && (
        <ul className="mt-0.5 mb-1 space-y-0.5">
          {groupe.entrees.map((entree) => (
            <li key={entree.libelle}>
              <Entree entree={entree} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Entree({ entree }: { entree: EntreeMenu }) {
  // À VENIR : visible mais explicitement indisponible. Pas un lien, pas cliquable, grisé,
  // avec une mention « bientôt » — aucune fausse promesse. title au survol pour le détail.
  if (entree.etat === 'a_venir') {
    return (
      <span
        aria-disabled="true"
        title={LIBELLES.menu.aVenir}
        className="flex cursor-not-allowed items-center justify-between rounded px-2 py-1.5 pl-7 text-sm text-muted-foreground/50"
      >
        {entree.libelle}
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
          {LIBELLES.menu.aVenirCourt}
        </span>
      </span>
    )
  }

  // ACTIVE : NavLink marque l'entrée courante (aria-current + fond) sans calcul manuel.
  // Sans `end` : l'entrée reste surlignée sur les sous-pages (fiche, création) — la section
  // « Utilisateurs » ne s'éteint pas quand on ouvre une fiche.
  return (
    <NavLink
      to={entree.chemin}
      className={({ isActive }) =>
        cn(
          'block rounded-md py-1.5 pr-2 pl-7 text-sm text-muted-foreground hover:bg-muted hover:text-foreground',
          // Entrée courante : accent bleu institutionnel (barre + fond léger), cohérent avec les Tiers.
          isActive &&
            'border-l-2 border-primary bg-brand-subtle pl-[calc(1.75rem-2px)] font-medium text-primary hover:bg-brand-subtle hover:text-primary',
        )
      }
    >
      {entree.libelle}
    </NavLink>
  )
}
