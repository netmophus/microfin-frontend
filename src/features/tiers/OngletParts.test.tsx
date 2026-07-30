import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { chargerParts, souscrireComptant, type FichePartsSociales } from '@/features/tiers/api'
import { OngletParts } from '@/features/tiers/OngletParts'

/**
 * Onglet Parts sociales. Points durs : le capital en francs, le barème PROVISOIRE, le cas LISIBLE
 * « client qui détient encore des parts », et le geste central « devenir membre » (souscription au
 * comptant réservée au caissier) qui rend le tiers sociétaire.
 */

const etat = vi.hoisted(() => ({ permissions: ['tiers.shares.read'] as string[] }))

vi.mock('@/features/auth/useProfil', () => ({
  useAPermission: (p: string) => etat.permissions.includes(p),
}))

vi.mock('@/features/tiers/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/tiers/api')>(
    '@/features/tiers/api',
  )
  return {
    ...reel,
    chargerParts: vi.fn(),
    souscrireComptant: vi.fn(),
    souscrireParts: vi.fn(),
    libererParts: vi.fn(),
  }
})

const partsSimule = vi.mocked(chargerParts)
const comptantSimule = vi.mocked(souscrireComptant)

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

function afficher(statut = 'actif') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <OngletParts tierId="t1" tierStatut={statut} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.permissions = ['tiers.shares.read']
})

describe('OngletParts', () => {
  it('membre : capital en francs, parts libérées, barème PROVISOIRE signalé', async () => {
    partsSimule.mockResolvedValue(base())
    afficher()

    expect(await screen.findByText('50 000 F')).toBeVisible()
    expect(screen.getByText(/10 parts libérées/)).toBeVisible()
    expect(screen.getByText('Membre')).toBeVisible()
    expect(screen.getByText('provisoire')).toBeVisible()
    expect(screen.getByText('5 000 F')).toBeVisible()
  })

  it('client qui détient encore des parts : bandeau LISIBLE, pas d’ambiguïté', async () => {
    partsSimule.mockResolvedValue(
      base({ is_member: false, shares_liberees: 2, capital_libere: 10000, minimum_shares: 5 }),
    )
    afficher()

    expect(await screen.findByText('Client')).toBeVisible()
    expect(screen.getByText(/N’est plus sociétaire/)).toBeVisible()
    expect(screen.getByText(/Non désactivable tant qu/)).toBeVisible()
  })

  it('aucune part : le dit clairement', async () => {
    partsSimule.mockResolvedValue(base({ is_member: false, shares_liberees: 0, capital_libere: 0 }))
    afficher()

    expect(await screen.findByText(/ne détient aucune part sociale/)).toBeVisible()
  })

  it('caissier : souscription au comptant → le tiers devient MEMBRE', async () => {
    etat.permissions = ['tiers.shares.read', 'tiers.shares.pay']
    // Au départ : client sans parts.
    partsSimule.mockResolvedValue(base({ is_member: false, shares_liberees: 0, capital_libere: 0 }))
    comptantSimule.mockResolvedValue({
      is_member: true,
      shares_liberees: 10,
      shares_non_liberees: 0,
      entry_number: 'OD-2026-000001',
    })
    afficher('actif')

    fireEvent.click(await screen.findByRole('button', { name: /Souscrire au comptant/ }))
    fireEvent.change(screen.getByLabelText('Nombre de parts'), { target: { value: '10' } })
    // Le total à encaisser est calculé et affiché.
    expect(screen.getByText(/10 parts × 5 000 F = 50 000 F à encaisser/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))
    // Confirmation qui répète l'effet (devenir membre).
    expect(screen.getByText(/rendre ce tiers MEMBRE/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))

    await waitFor(() => expect(comptantSimule).toHaveBeenCalledWith('t1', 10))
    expect(await screen.findByText(/désormais MEMBRE/)).toBeVisible()
  })

  it('gate : tiers non actif → l’action est expliquée, pas offerte', async () => {
    etat.permissions = ['tiers.shares.read', 'tiers.shares.pay']
    partsSimule.mockResolvedValue(base({ is_member: false, shares_liberees: 0, capital_libere: 0 }))
    afficher('prospect')

    expect(await screen.findByText(/doit être actif/)).toBeVisible()
    expect(screen.queryByRole('button', { name: /Souscrire au comptant/ })).toBeNull()
  })
})
