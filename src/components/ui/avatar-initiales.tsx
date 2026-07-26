import { cn } from '@/lib/utils'

/** Avatar à initiales — rond, fond bleu clair institutionnel. Pour la liste et l'en-tête de fiche. */
function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter(Boolean)
  const premier = mots[0]
  if (!premier) return '?'
  const dernier = mots[mots.length - 1] ?? premier
  if (mots.length === 1) return premier.slice(0, 2).toUpperCase()
  return ((premier[0] ?? '') + (dernier[0] ?? '')).toUpperCase()
}

export function AvatarInitiales({
  nom,
  taille = 'md',
  className,
}: {
  nom: string
  taille?: 'md' | 'lg'
  className?: string
}) {
  const dim = taille === 'lg' ? 'size-12 text-base' : 'size-9 text-sm'
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-brand-subtle font-semibold text-brand',
        dim,
        className,
      )}
    >
      {initiales(nom)}
    </span>
  )
}
