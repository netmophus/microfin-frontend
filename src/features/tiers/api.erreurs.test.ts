import { AxiosError, type AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { LIBELLES } from '@/libelles/fr'

import {
  detailServeur,
  ErreurModification,
  messageErreurHttp,
  messageErreurServeur,
  modifierPersonneMorale,
  type ModificationPersonneMorale,
} from './api'

/**
 * Un refus du serveur doit arriver à l'écran avec SA raison, jamais en « vérifiez les champs »
 * seul. Seules les phrases françaises du serveur sont reprises : les messages techniques anglais
 * de Pydantic ne sont jamais affichés.
 */

vi.mock('@/lib/api', () => ({ api: { patch: vi.fn(), post: vi.fn(), get: vi.fn() } }))

function refus(status: number, detail?: unknown): AxiosError {
  const reponse = { status, data: detail === undefined ? {} : { detail } } as AxiosResponse
  return new AxiosError('échec', 'ERR_BAD_REQUEST', undefined, undefined, reponse)
}

const FRANCS = "Le capital social s'exprime en francs entiers, sans décimales."
const CORPS: ModificationPersonneMorale = {
  legal_name: 'TANDA SERVICES',
  commercial_name: null,
  legal_form: 'SARL',
  rccm_number: null,
  nif_number: null,
  constitution_date: '2024-01-01',
  capital_amount: 1000000,
  capital_currency_id: null,
  business_purpose: null,
  headquarters_country_id: 'pays-ne',
}

beforeEach(() => vi.clearAllMocks())

describe('detailServeur', () => {
  it('reprend un detail texte tel quel', () => {
    expect(detailServeur(refus(422, 'Ce numéro RCCM est déjà rattaché à une autre fiche.'))).toBe(
      'Ce numéro RCCM est déjà rattaché à une autre fiche.',
    )
  })

  it('reprend la phrase française d’une règle de validation, sans son préfixe technique', () => {
    const detail = [{ loc: ['body', 'capital_amount'], msg: `Value error, ${FRANCS}`, type: 'value_error' }]
    expect(detailServeur(refus(422, detail))).toBe(FRANCS)
  })

  it('n’affiche jamais un message technique anglais de Pydantic', () => {
    const detail = [
      { loc: ['body', 'legal_form'], msg: 'Input should be a valid string', type: 'string_type' },
    ]
    expect(detailServeur(refus(422, detail))).toBeNull()
  })

  it('ne dit rien quand le serveur n’a rien dit', () => {
    expect(detailServeur(refus(500))).toBeNull()
    expect(detailServeur(new Error('autre'))).toBeNull()
  })
})

describe('messageErreurHttp', () => {
  it('dit ce qui s’est passé selon le code', () => {
    expect(messageErreurHttp(refus(403))).toBe('Vous n’avez pas l’autorisation d’effectuer cette action.')
    expect(messageErreurHttp(refus(404))).toBe('Cette fiche est introuvable ou hors de votre périmètre.')
    expect(messageErreurHttp(refus(405))).toContain('code 405')
    expect(messageErreurHttp(refus(500))).toContain('code 500')
  })

  it('serveur injoignable : pas de réponse', () => {
    expect(messageErreurHttp(new AxiosError('Network Error'))).toBe(LIBELLES.erreurs.serveurInjoignable)
  })

  it('un 422 sans message exploitable reste à la charge de l’appelant', () => {
    expect(messageErreurHttp(refus(422))).toBeNull()
  })
})

describe('messageErreurServeur', () => {
  it('ordre : message du serveur, puis code HTTP, puis défaut', () => {
    expect(messageErreurServeur(refus(422, 'Raison précise.'), 'défaut')).toBe('Raison précise.')
    expect(messageErreurServeur(refus(404), 'défaut')).toBe(
      'Cette fiche est introuvable ou hors de votre périmètre.',
    )
    expect(messageErreurServeur(refus(422), 'défaut')).toBe('défaut')
  })
})

describe('modifierPersonneMorale', () => {
  it('un capital décimal refusé remonte avec la phrase du serveur', async () => {
    vi.mocked(api.patch).mockRejectedValue(
      refus(422, [{ loc: ['body', 'capital_amount'], msg: `Value error, ${FRANCS}`, type: 'value_error' }]),
    )

    await expect(modifierPersonneMorale('t1', CORPS)).rejects.toMatchObject({
      name: 'ErreurModification',
      detail: FRANCS,
    })
  })

  it('un 405 (route absente du serveur lancé) est nommé, pas masqué', async () => {
    vi.mocked(api.patch).mockRejectedValue(refus(405))

    const erreur = await modifierPersonneMorale('t1', CORPS).catch((e: unknown) => e)

    expect(erreur).toBeInstanceOf(ErreurModification)
    expect((erreur as ErreurModification).detail).toContain('code 405')
  })

  it('envoie le capital en entier', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { id: 't1' } })

    await modifierPersonneMorale('t1', CORPS)

    expect(api.patch).toHaveBeenCalledWith('/tiers/t1/legal-entity', CORPS)
    expect(vi.mocked(api.patch).mock.calls[0]?.[1]).toMatchObject({ capital_amount: 1000000 })
  })
})
