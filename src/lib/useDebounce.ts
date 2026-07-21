import { useEffect, useState } from 'react'

/**
 * Rend une valeur avec un délai, remis à zéro à chaque changement.
 *
 * Sur la recherche, sans lui, chaque frappe déclenche une requête : taper « Traoré » en
 * lancerait six. Le debounce n'émet qu'après une pause de saisie — moins de charge serveur
 * et une liste qui ne clignote pas à chaque lettre.
 */
export function useDebounce<T>(valeur: T, delaiMs = 300): T {
  const [differee, setDifferee] = useState(valeur)

  useEffect(() => {
    const minuteur = setTimeout(() => setDifferee(valeur), delaiMs)
    return () => clearTimeout(minuteur)
  }, [valeur, delaiMs])

  return differee
}
