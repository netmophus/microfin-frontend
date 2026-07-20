import { describe, expect, it } from 'vitest'

import { estConforme, reglesViolees } from '@/features/auth/politique'

/**
 * Le miroir de la politique doit correspondre EXACTEMENT au backend.
 *
 * Ces cas sont ceux qui piègent : l'espace non compté comme spécial, la lettre accentuée
 * qui n'est pas un caractère spécial. Un miroir qui les traiterait autrement afficherait
 * « conforme » là où le serveur répond 422, laissant l'utilisateur devant un formulaire qui
 * lui ment.
 */
describe('politique de mot de passe (miroir du backend)', () => {
  it('accepte un mot de passe conforme aux cinq règles', () => {
    expect(estConforme('Guichet!Mifin2026')).toBe(true)
  })

  it('exige au moins 12 caractères', () => {
    expect(reglesViolees('Aa1!bcd')).toContain('longueur_minimale')
    expect(reglesViolees('Aa1!bcdefghi')).not.toContain('longueur_minimale')
  })

  it('exige chaque famille de caractères', () => {
    expect(reglesViolees('minusculesans1!')).toContain('majuscule_requise')
    expect(reglesViolees('MAJUSCULESANS1!')).toContain('minuscule_requise')
    expect(reglesViolees('SansChiffre!!!!')).toContain('chiffre_requis')
    expect(reglesViolees('SansSpecial1234')).toContain('caractere_special_requis')
  })

  it('NE compte PAS l’espace comme caractère spécial (comme le backend)', () => {
    // « mot de passe » contient des espaces mais aucun signe de string.punctuation.
    expect(reglesViolees('Mot De Passe12')).toContain('caractere_special_requis')
  })

  it('NE compte PAS une lettre accentuée comme spéciale', () => {
    // « é » satisfait « minuscule », jamais « caractère spécial ». Sans chiffre ni signe,
    // ce mot de passe doit être refusé sur ces deux règles précises.
    const violations = reglesViolees('Éléphantprécédé')
    expect(violations).toContain('caractere_special_requis')
    expect(violations).toContain('chiffre_requis')
    expect(violations).not.toContain('minuscule_requise')
    expect(violations).not.toContain('majuscule_requise')
  })

  it('accepte les 32 signes ASCII de string.punctuation', () => {
    for (const signe of '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~') {
      expect(estConforme(`Abcdefghij1${signe}`)).toBe(true)
    }
  })
})
