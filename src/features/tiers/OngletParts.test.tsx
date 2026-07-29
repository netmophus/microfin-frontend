import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { chargerParts, type FichePartsSociales } from '@/features/tiers/api'
import { OngletParts } from '@/features/tiers/OngletParts'

/**
 * Onglet Parts sociales (lecture). Points durs : le capital en francs, le barème PROVISOIRE
 * signalé, et surtout le cas LISIBLE « client qui détient encore des parts » (partiel sous le
 * minimum) — ni tout à fait membre, ni sans lien capital.
 */

vi.mock('@/features/tiers/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/tiers/api')>(
    '@/features/tiers/api',
  )
  return { ...reel, chargerParts: vi.fn() }
})

const partsSimule = vi.mocked(chargerParts)

function base(o: Partial<FichePartsSociales> = {}): FichePartsSociales {
  return {
    is_member: true,
    shares_liberees: 10,
    shares_non_liberees: 0,
    capital_libere: 50000,
    capital_non_libere: 0,
    unit_value: 5000,
    minimum_shares: 1,
    is_refundable: true,
    membership_on: 'liberation',
    is_provisional: true,
    mouvements: [],
    ...o,
  }
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <OngletParts tierId="t1" />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('OngletParts', () => {
  it('membre : capital en francs, parts libérées, barème PROVISOIRE signalé', async () => {
    partsSimule.mockResolvedValue(base())
    afficher()

    expect(await screen.findByText('50 000 F')).toBeVisible()
    expect(screen.getByText(/10 parts libérées/)).toBeVisible()
    expect(screen.getByText('Membre')).toBeVisible()
    // La valeur d'une part est marquée provisoire.
    expect(screen.getByText('provisoire')).toBeVisible()
    expect(screen.getByText('5 000 F')).toBeVisible()
  })

  it('client qui détient encore des parts : bandeau LISIBLE, pas d’ambiguïté', async () => {
    // Remboursement partiel sous le minimum : plus membre, mais 2 parts restantes.
    partsSimule.mockResolvedValue(
      base({ is_member: false, shares_liberees: 2, capital_libere: 10000, minimum_shares: 5 }),
    )
    afficher()

    expect(await screen.findByText('Client')).toBeVisible()
    expect(screen.getByText(/N’est plus sociétaire/)).toBeVisible()
    expect(screen.getByText(/Non désactivable tant qu/)).toBeVisible()
  })

  it('aucune part : le dit clairement', async () => {
    partsSimule.mockResolvedValue(
      base({ is_member: false, shares_liberees: 0, capital_libere: 0 }),
    )
    afficher()

    expect(await screen.findByText(/ne détient aucune part sociale/)).toBeVisible()
  })
})
