import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listerTiers, type LigneTier } from '@/features/tiers/api'
import { PageTiers } from '@/features/tiers/PageTiers'

vi.mock('@/features/auth/useProfil', () => ({
  useProfil: () => ({ data: { permissions: [] } }),
  useAPermission: () => false,
}))

vi.mock('@/features/tiers/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/tiers/api')>('@/features/tiers/api')
  return { ...reel, listerTiers: vi.fn() }
})

vi.mock('@/features/utilisateurs/agences', () => ({
  listerAgences: vi.fn().mockResolvedValue([{ id: 'a1', code: 'AG1', name: 'Agence Centre' }]),
}))

const listerSimule = vi.mocked(listerTiers)

function ligne(partiel: Partial<LigneTier>): LigneTier {
  return {
    id: crypto.randomUUID(),
    tier_number: 'M-2026-0000001',
    tier_type: 'individual',
    display_name: 'Diallo Amadou',
    status: 'prospect',
    primary_agency_id: 'a1',
    ...partiel,
  }
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PageTiers />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('PageTiers', () => {
  it('traduit le type et le statut, et résout le nom de l’agence', async () => {
    listerSimule.mockResolvedValue({ lignes: [ligne({})], total: 1, page: 1, taille: 25 })

    afficher()

    expect(await screen.findByText('Diallo Amadou')).toBeVisible()
    expect(screen.getByText('Personne physique')).toBeVisible() // type traduit, pas 'individual'
    expect(screen.getByText('Prospect')).toBeVisible() // statut traduit
    expect(screen.getByText('Agence Centre')).toBeVisible() // id résolu en nom
    expect(screen.queryByText('individual')).toBeNull() // aucun code brut
  })

  it('base vide : un message, pas un tableau vide', async () => {
    listerSimule.mockResolvedValue({ lignes: [], total: 0, page: 1, taille: 25 })

    afficher()

    expect(await screen.findByText(/aucun tiers enregistré/i)).toBeVisible()
  })
})
