import { describe, expect, it } from 'vitest'

import { parseMontantFrancs } from '@/lib/montants'

describe('parseMontantFrancs', () => {
  it.each([
    ['5000', 5000],
    ['5 000', 5000],
    ['5\u00a0000', 5000],
    ['5\u202f000', 5000],
    ['1 250 000', 1250000],
    ['5.000', 5000],
    ['1.250.000', 1250000],
    ['0', 0],
    [' 7 ', 7],
  ])('« %s » est accepté et vaut %d', (saisie, attendu) => {
    expect(parseMontantFrancs(saisie)).toBe(attendu)
  })

  it.each([
    [''],
    ['   '],
    ['5 000,50'],
    ['5000.50'],
    ['5.5'],
    ['-5000'],
    ['abc'],
    ['5 mille'],
    ['1e3'],
    ['99999999999999999999'],
  ])('« %s » est refusé', (saisie) => {
    expect(parseMontantFrancs(saisie)).toBeNull()
  })
})
