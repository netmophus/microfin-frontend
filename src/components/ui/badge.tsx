import { cva, type VariantProps } from 'class-variance-authority'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Badge de statut — DÉFINITION UNIQUE, réutilisée partout (statut de fiche, risque, validité,
 * vérification). Forme pilule, pastille + texte : la couleur n'est JAMAIS la seule information
 * (accessibilité). Les tons pointent vers les tokens de thème, jamais de couleur en dur.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      ton: {
        success: 'bg-success-subtle text-success',
        warning: 'bg-warning-subtle text-warning',
        danger: 'bg-danger-subtle text-danger',
        neutral: 'bg-neutral-badge-subtle text-neutral-badge',
        brand: 'bg-brand-subtle text-brand',
      },
    },
    defaultVariants: { ton: 'neutral' },
  },
)

export type BadgeTon = NonNullable<VariantProps<typeof badgeVariants>['ton']>

export function Badge({
  ton,
  pastille = true,
  className,
  children,
}: {
  ton: BadgeTon
  pastille?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <span className={cn(badgeVariants({ ton }), className)}>
      {pastille && <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  )
}
