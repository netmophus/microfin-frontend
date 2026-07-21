import { Check, Copy, KeyRound } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { LIBELLES } from '@/libelles/fr'

const T = LIBELLES.motDePasseProvisoire

/**
 * Révélation du mot de passe provisoire — LE point le plus important de l'écran de création.
 *
 * Ce mot de passe n'existe QU'ICI, une seule fois : le serveur ne le stocke jamais en clair
 * et ne le redonnera pas. Le fermer sans l'avoir noté rend le compte inutilisable jusqu'à
 * réinitialisation. Ce n'est donc PAS une notification discrète — c'est un point de passage :
 *
 *   - le mot de passe est affiché en grand, lisible, copiable d'un clic ;
 *   - l'avertissement dit explicitement qu'il ne réapparaîtra jamais ;
 *   - le bouton de fermeture reste DÉSACTIVÉ tant que l'utilisateur n'a pas coché « j'ai
 *     noté ». On l'oblige à confirmer, on ne se contente pas de l'espérer.
 */
export function MotDePasseProvisoire({
  nom,
  motDePasse,
  onTermine,
}: {
  nom: string
  motDePasse: string
  onTermine: () => void
}) {
  const [copie, setCopie] = useState(false)
  const [confirme, setConfirme] = useState(false)

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(motDePasse)
      setCopie(true)
      setTimeout(() => setCopie(false), 2000)
    } catch {
      // Le presse-papiers peut être refusé (permission, contexte non sécurisé). Ce n'est pas
      // bloquant : le mot de passe reste lisible et recopiable à la main.
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 rounded-lg border-2 border-amber-400 bg-amber-50 p-6">
      <div className="flex items-center gap-2 text-amber-900">
        <KeyRound className="size-5 shrink-0" aria-hidden />
        <h2 className="text-lg font-semibold">{T.titre}</h2>
      </div>

      <p className="text-sm text-amber-900">{T.intro(nom)}</p>

      <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-white p-3">
        <code className="flex-1 select-all font-mono text-lg tracking-wide">{motDePasse}</code>
        <Button type="button" variant="outline" size="sm" onClick={() => void copier()}>
          {copie ? (
            <>
              <Check className="mr-1.5 size-4" aria-hidden />
              {T.copie}
            </>
          ) : (
            <>
              <Copy className="mr-1.5 size-4" aria-hidden />
              {T.copier}
            </>
          )}
        </Button>
      </div>

      <p className="text-sm font-medium text-amber-900">{T.avertissement}</p>
      <p className="text-sm text-amber-900">{T.transmission}</p>

      <label className="flex items-start gap-2 text-sm text-amber-900">
        <input
          type="checkbox"
          checked={confirme}
          onChange={(e) => setConfirme(e.target.checked)}
          className="mt-0.5 size-4 shrink-0"
        />
        <span>{T.confirmation}</span>
      </label>

      <Button type="button" className="w-full" disabled={!confirme} onClick={onTermine}>
        {T.terminer}
      </Button>
    </div>
  )
}
