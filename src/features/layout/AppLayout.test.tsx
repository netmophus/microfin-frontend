import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { chargerProfil } from '@/features/auth/profil'
import { AppLayout } from '@/features/layout/AppLayout'

/**
 * En-tête : le nom NE SUFFIT PAS. Dans une IMF où l'on peut changer de fonction ou avoir
 * plusieurs comptes, on doit lire « en quelle qualité » on est connecté, et sur quelle agence.
 */

vi.mock('@/features/auth/profil', async () => {
  const reel = await vi.importActual<typeof import('@/features/auth/profil')>('@/features/auth/profil')
  return { ...reel, chargerProfil: vi.fn() }
})

const profilSimule = vi.mocked(chargerProfil)

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('AppLayout', () => {
  it('affiche le nom, la qualité (rôles) et l’agence courante', async () => {
    profilSimule.mockResolvedValue({
      id: 'u1',
      username: 'rdodo',
      last_name: 'Dodo',
      first_name: 'Ramatou',
      roles: [
        { code: 'CHARGE_CLIENTELE', name: 'Chargé de clientèle' },
        { code: 'CAISSIER', name: 'Caissier' },
      ],
      permissions: [],
      agence_courante: { id: 'a1', code: 'AG-001', name: 'Siège' },
      must_change_password: false,
    })

    afficher()

    expect(await screen.findByText('Ramatou Dodo')).toBeVisible()
    // Les deux rôles ET l'agence, sur une même ligne discrète sous le nom.
    expect(screen.getByText(/Chargé de clientèle, Caissier/)).toBeVisible()
    expect(screen.getByText(/Siège/)).toBeVisible()
  })
})
