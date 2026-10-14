const UNITES = [
  'zéro',
  'un',
  'deux',
  'trois',
  'quatre',
  'cinq',
  'six',
  'sept',
  'huit',
  'neuf',
  'dix',
  'onze',
  'douze',
  'treize',
  'quatorze',
  'quinze',
  'seize',
] as const

const DIZAINES = [
  '',
  '',
  'vingt',
  'trente',
  'quarante',
  'cinquante',
  'soixante',
  'soixante',
  'quatre-vingt',
  'quatre-vingt',
] as const

const MILLE = 1_000
const MILLION = 1_000_000
const MILLIARD = 1_000_000_000
const LIMITE = 1_000_000_000_000 // exclue : on écrit jusqu'aux centaines de milliards

/**
 * 0 à 99. « vingt » et « quatre-vingt » prennent un « s » seulement quand ils terminent le
 * nombre (`final`) : « quatre-vingts », mais « quatre-vingt-un » et « quatre-vingt mille ».
 */
function moinsDeCent(n: number, final: boolean): string {
  if (n < 17) return UNITES[n]!
  if (n < 20) return `dix-${UNITES[n - 10]!}`
  const dizaine = Math.floor(n / 10)
  const unite = n % 10
  if (dizaine === 7 || dizaine === 9) {
    // soixante-dix… ; quatre-vingt-dix… : 10 à 19 s'ajoutent à la dizaine précédente.
    const suite = n - (dizaine - 1) * 10
    const base = DIZAINES[dizaine]!
    if (dizaine === 7 && suite === 11) return `${base} et onze`
    return `${base}-${moinsDeCent(suite, final)}`
  }
  const base = DIZAINES[dizaine]!
  if (unite === 0) return dizaine === 8 && final ? `${base}s` : base
  if (unite === 1 && dizaine !== 8) return `${base} et un`
  return `${base}-${UNITES[unite]!}`
}

/** 0 à 999. « cent » prend un « s » quand il est multiplié ET termine le nombre. */
function moinsDeMille(n: number, final: boolean): string {
  if (n < 100) return moinsDeCent(n, final)
  const centaines = Math.floor(n / 100)
  const reste = n % 100
  const cent = centaines === 1 ? 'cent' : `${UNITES[centaines]!} cent${reste === 0 && final ? 's' : ''}`
  return reste === 0 ? cent : `${cent} ${moinsDeCent(reste, final)}`
}

function assembler(n: number): string {
  if (n === 0) return 'zéro'
  const milliards = Math.floor(n / MILLIARD)
  const millions = Math.floor((n % MILLIARD) / MILLION)
  const milliers = Math.floor((n % MILLION) / MILLE)
  const reste = n % MILLE
  const morceaux: string[] = []
  if (milliards > 0) {
    morceaux.push(`${moinsDeMille(milliards, true)} milliard${milliards > 1 ? 's' : ''}`)
  }
  if (millions > 0) {
    morceaux.push(`${moinsDeMille(millions, true)} million${millions > 1 ? 's' : ''}`)
  }
  if (milliers > 0) {
    // « mille » est invariable et ne prend pas de « un » devant : « mille », « deux mille ».
    morceaux.push(milliers === 1 ? 'mille' : `${moinsDeMille(milliers, false)} mille`)
  }
  if (reste > 0) morceaux.push(moinsDeMille(reste, true))
  return morceaux.join(' ')
}

/**
 * Montant en francs CFA ENTIERS écrit en toutes lettres, pour les pièces justificatives :
 * « deux millions de francs CFA ». Fonction pure, sans dépendance. Refuse (RangeError) un
 * montant négatif, décimal ou à partir de mille milliards : un reçu ne doit jamais afficher une
 * somme approximative.
 */
export function montantEnLettres(montant: number): string {
  if (!Number.isInteger(montant) || montant < 0 || montant >= LIMITE) {
    throw new RangeError(`Montant impossible à écrire en lettres : ${montant}`)
  }
  const nombre = assembler(montant)
  // Un million / un milliard « ronds » se lient au nom par « de » : « deux millions de francs ».
  const rond = montant >= MILLION && montant % MILLION === 0
  const unite = montant >= 2 ? 'francs CFA' : 'franc CFA'
  return `${nombre} ${rond ? 'de ' : ''}${unite}`
}
