import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  lireParametresParts,
  listerComptesSelecteur,
  modifierParametresParts,
  type CompteSelecteur,
  type ParametresParts,
} from '@/features/comptabilite/api'
import { PageParametresParts } from '@/features/comptabilite/PageParametresParts'

/**
 * Paramètres des parts sociales (Bloc 5). Points durs : moment d'adhésion limité à un menu
 * fermé (pas de saisie libre), motif obligatoire, une config absente (404) affiche un message
 * humain plutôt qu'un écran cassé.
 */

const etat = vi.hoisted(() => ({ permissions: ['compta.plan.manage'] as string[] }))

vi.mock('@/features/auth/useProfil', () => ({
  useAPermission: (p: string) => etat.permissions.includes(p),
}))

vi.mock('@/features/comptabilite/api', async () => {
  const reel =
    await vi.importActual<typeof import('@/features/comptabilite/api')>(
      '@/features/comptabilite/api',
    )
  return {
    ...reel,
    lireParametresParts: vi.fn(),
    listerComptesSelecteur: vi.fn(),
    modifierParametresParts: vi.fn(),
  }
})

const lireSimule = vi.mocked(lireParametresParts)
const listerComptesSimule = vi.mocked(listerComptesSelecteur)
const modifierSimule = vi.mocked(modifierParametresParts)

function config(partiel: Partial<ParametresParts> = {}): ParametresParts {
  return {
    unit_value: 5000,
    minimum_shares: 1,
    is_refundable: true,
    membership_on: 'liberation',
    compte_parts_liberees: { account_number: '57111', name: 'Parts libérées' },
    compte_parts_non_liberees: null,
    is_provisional: true,
    ...partiel,
  }
}

const comptesSelecteur: CompteSelecteur[] = [
  { id: 'c1', account_number: '57111', name: 'Parts libérées' },
  { id: 'c2', account_number: '57112', name: 'Parts non libérées' },
]

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PageParametresParts />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.permissions = ['compta.plan.manage']
  listerComptesSimule.mockResolvedValue(comptesSelecteur)
})

describe('PageParametresParts', () => {
  it('affiche les valeurs et le compte rattaché résolu', async () => {
    lireSimule.mockResolvedValue(config())
    afficher()

    expect(await screen.findByText('5 000 FCFA')).toBeVisible()
    expect(screen.getByText('57111 — Parts libérées')).toBeVisible()
    expect(screen.getByText('provisoire')).toBeVisible()
  })

  it('404 : « pas encore paramétrées », pas un écran cassé', async () => {
    lireSimule.mockRejectedValue(
      new AxiosError('non trouvé', undefined, undefined, undefined, { status: 404 } as never),
    )
    afficher()

    expect(await screen.findByText(/ne sont pas encore paramétrées/i)).toBeVisible()
  })

  it('« Modifier » absent sans compta.plan.manage', async () => {
    etat.permissions = []
    lireSimule.mockResolvedValue(config())
    afficher()
    await screen.findByText('57111 — Parts libérées')

    expect(screen.queryByRole('button', { name: 'Modifier' })).toBeNull()
  })

  it('édition : moment d’adhésion limité au menu, motif obligatoire', async () => {
    lireSimule.mockResolvedValue(config())
    modifierSimule.mockResolvedValue(config({ unit_value: 10000 }))
    afficher()
    await screen.findByText('57111 — Parts libérées')

    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    const moment = await screen.findByLabelText('Moment de l’adhésion')
    expect(moment.tagName).toBe('SELECT')
    const options = Array.from(moment.querySelectorAll('option')).map((o) => o.textContent)
    expect(options).toEqual(['À la souscription', 'À la libération'])

    const enregistrer = screen.getByRole('button', { name: 'Enregistrer' })
    expect(enregistrer).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Valeur d’une part (francs CFA)'), {
      target: { value: '10000' },
    })
    fireEvent.change(screen.getByLabelText('Motif (obligatoire)'), {
      target: { value: 'Revalorisation de la part' },
    })
    expect(enregistrer).not.toBeDisabled()
    fireEvent.click(enregistrer)

    await waitFor(() =>
      expect(modifierSimule).toHaveBeenCalledWith(
        expect.objectContaining({ unit_value: 10000, motif: 'Revalorisation de la part' }),
      ),
    )
  })
})
