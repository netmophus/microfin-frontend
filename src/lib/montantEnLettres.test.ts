import { describe, expect, it } from 'vitest'

import { montantEnLettres } from '@/lib/montantEnLettres'

describe('montantEnLettres', () => {
  it.each([
    [0, 'zéro franc CFA'],
    [1, 'un franc CFA'],
    [2, 'deux francs CFA'],
    [16, 'seize francs CFA'],
    [17, 'dix-sept francs CFA'],
    [20, 'vingt francs CFA'],
    [21, 'vingt et un francs CFA'],
    [22, 'vingt-deux francs CFA'],
    [31, 'trente et un francs CFA'],
    [61, 'soixante et un francs CFA'],
    [70, 'soixante-dix francs CFA'],
    [71, 'soixante et onze francs CFA'],
    [77, 'soixante-dix-sept francs CFA'],
    [80, 'quatre-vingts francs CFA'],
    [81, 'quatre-vingt-un francs CFA'],
    [90, 'quatre-vingt-dix francs CFA'],
    [91, 'quatre-vingt-onze francs CFA'],
    [99, 'quatre-vingt-dix-neuf francs CFA'],
    [100, 'cent francs CFA'],
    [101, 'cent un francs CFA'],
    [180, 'cent quatre-vingts francs CFA'],
    [200, 'deux cents francs CFA'],
    [201, 'deux cent un francs CFA'],
    [999, 'neuf cent quatre-vingt-dix-neuf francs CFA'],
  ])('%i -> %s', (montant, lettres) => {
    expect(montantEnLettres(montant)).toBe(lettres)
  })

  it.each([
    [1_000, 'mille francs CFA'],
    [1_001, 'mille un francs CFA'],
    [2_000, 'deux mille francs CFA'],
    [21_000, 'vingt et un mille francs CFA'],
    // « vingt » et « cent » ne prennent pas de s devant « mille » (invariable, ils ne terminent pas).
    [80_000, 'quatre-vingt mille francs CFA'],
    [200_000, 'deux cent mille francs CFA'],
    [250_000, 'deux cent cinquante mille francs CFA'],
    [1_000_000, 'un million de francs CFA'],
    [2_000_000, 'deux millions de francs CFA'],
    [2_500_000, 'deux millions cinq cent mille francs CFA'],
    [12_345_678, 'douze millions trois cent quarante-cinq mille six cent soixante-dix-huit francs CFA'],
    // Devant « million », ils terminent le multiplicateur : « quatre-vingts millions », « deux cents millions ».
    [80_000_000, 'quatre-vingts millions de francs CFA'],
    [200_000_000, 'deux cents millions de francs CFA'],
    [1_000_000_000, 'un milliard de francs CFA'],
    [2_000_000_000, 'deux milliards de francs CFA'],
    [
      999_999_999_999,
      'neuf cent quatre-vingt-dix-neuf milliards neuf cent quatre-vingt-dix-neuf millions neuf cent quatre-vingt-dix-neuf mille neuf cent quatre-vingt-dix-neuf francs CFA',
    ],
  ])('%i -> %s', (montant, lettres) => {
    expect(montantEnLettres(montant)).toBe(lettres)
  })

  it('refuse ce qu’un reçu ne doit jamais approximer : négatif, décimal, trop grand', () => {
    expect(() => montantEnLettres(-1)).toThrow(RangeError)
    expect(() => montantEnLettres(10.5)).toThrow(RangeError)
    expect(() => montantEnLettres(Number.NaN)).toThrow(RangeError)
    expect(() => montantEnLettres(1_000_000_000_000)).toThrow(RangeError)
  })
})
