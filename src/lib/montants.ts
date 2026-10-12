// Espace insécable (U+00A0) et fine insécable (U+202F) : celles que le SIG et Excel produisent.
const ESPACES = /[\s\u00a0\u202f]/g
// Le point n'est un séparateur de milliers que s'il groupe par trois chiffres : « 5.000 » vaut
// 5000, mais « 5.5 » est une décimale et reste refusée.
const MILLIERS_AVEC_POINTS = /^\d{1,3}(\.\d{3})+$/
const CHIFFRES = /^\d+$/

/**
 * Montant en francs entiers saisi par l'agent : « 5 000 » (espace simple ou insécable) ou
 * « 5.000 » donnent 5000. Retourne null si la saisie est vide ou n'est pas un entier positif
 * ou nul (décimales, lettres, signe).
 */
export function parseMontantFrancs(saisie: string): number | null {
  const sansEspaces = saisie.replace(ESPACES, '')
  const chiffres = MILLIERS_AVEC_POINTS.test(sansEspaces) ? sansEspaces.replace(/\./g, '') : sansEspaces
  if (!CHIFFRES.test(chiffres)) return null
  const valeur = Number(chiffres)
  return Number.isSafeInteger(valeur) ? valeur : null
}
