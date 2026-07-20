/**
 * MIROIR de la politique de mot de passe du backend (§6).
 *
 * ⚠️ DETTE DE SYNCHRONISATION ASSUMÉE — À LIRE AVANT DE MODIFIER.
 *
 * Ces règles DUPLIQUENT `valider_politique` de app/modules/security/password.py. Le
 * serveur reste seul juge : il refuse en 422 quoi que le front affiche. Cette copie
 * n'existe que pour le RETOUR EN DIRECT pendant la saisie — sans lui, l'utilisateur
 * découvre les règles une par une, par échecs successifs, et beaucoup abandonnent.
 *
 * Le danger d'une copie est qu'elle diverge. Un front qui affiche « conforme » quand le
 * serveur répond 422 laisse l'utilisateur devant un formulaire qui lui MENT, sans aucun
 * moyen de s'en sortir. C'est pire que pas de retour du tout.
 *
 * SI LA POLITIQUE DU BACKEND CHANGE (longueur, familles exigées, jeu de caractères
 * spéciaux, ou `PolitiqueMotDePasse` rendue configurable par IMF), CE FICHIER DOIT CHANGER
 * AVEC. À terme, la bonne réponse est que le serveur EXPOSE sa politique (un GET
 * /auth/politique-mot-de-passe) et que le front la lise, ce qui supprimera la copie.
 *
 * TROIS SUBTILITÉS reprises à l'identique du backend, et qui ne se devinent pas :
 *
 *   - les caractères spéciaux sont `string.punctuation` de Python, soit les 32 signes
 *     ASCII — ni plus, ni moins ;
 *   - L'ESPACE N'EN FAIT PAS PARTIE : « mot de passe long » ne satisfait pas la règle ;
 *   - « é » NE COMPTE PAS comme spécial. Python considère que c'est une minuscule
 *     (`'é'.islower()` est vrai), donc il satisfait « minuscule » et rien d'autre.
 */

/** Les 32 signes de `string.punctuation` (Python), recopiés dans leur ordre d'origine. */
const CARACTERES_SPECIAUX = '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'

export const LONGUEUR_MINIMALE = 12

/**
 * Codes renvoyés par le backend dans le détail d'un 422 (`RegleMotDePasse`).
 * Les mêmes servent d'identifiants au retour en direct : une seule notion, un seul nom.
 */
export type CodeRegle =
  | 'longueur_minimale'
  | 'majuscule_requise'
  | 'minuscule_requise'
  | 'chiffre_requis'
  | 'caractere_special_requis'

export interface Regle {
  code: CodeRegle
  satisfaite: (motDePasse: string) => boolean
}

export const REGLES: readonly Regle[] = [
  {
    code: 'longueur_minimale',
    satisfaite: (m) => m.length >= LONGUEUR_MINIMALE,
  },
  {
    // Miroir de `c.isupper()`. Sur une lettre accentuée majuscule (« É »), JavaScript et
    // Python sont d'accord : c'est une majuscule.
    code: 'majuscule_requise',
    satisfaite: (m) => [...m].some((c) => c !== c.toLowerCase() && c === c.toUpperCase()),
  },
  {
    code: 'minuscule_requise',
    satisfaite: (m) => [...m].some((c) => c !== c.toUpperCase() && c === c.toLowerCase()),
  },
  {
    // `c.isdigit()` de Python accepte aussi des chiffres non-ASCII (exposants, chiffres
    // arabes-indiens). Le cas ne se présente pas à la saisie d'un mot de passe au clavier
    // latin, et se tromper ici ne peut que rendre le front PLUS strict que le serveur —
    // donc afficher « non conforme » sur un mot de passe accepté, jamais l'inverse.
    code: 'chiffre_requis',
    satisfaite: (m) => [...m].some((c) => c >= '0' && c <= '9'),
  },
  {
    code: 'caractere_special_requis',
    satisfaite: (m) => [...m].some((c) => CARACTERES_SPECIAUX.includes(c)),
  },
] as const

/** Les codes des règles NON satisfaites, dans l'ordre d'affichage. */
export function reglesViolees(motDePasse: string): CodeRegle[] {
  return REGLES.filter((regle) => !regle.satisfaite(motDePasse)).map((regle) => regle.code)
}

export function estConforme(motDePasse: string): boolean {
  return reglesViolees(motDePasse).length === 0
}
