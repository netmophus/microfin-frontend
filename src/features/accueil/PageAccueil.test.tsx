import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { chargerProfil } from '@/features/auth/profil'
import { PageAccueil } from '@/features/accueil/PageAccueil'

/**
 * Accueil — le point qui empêche le bug signalé : un compte sans users.read atterrissait sur
 * la liste et voyait un refus rouge. Ici, il reçoit un mot d'accueil calme.
 */

vi.mock('@/features/auth/profil', async () => {
  const reel = await vi.importActual<typeof import('@/features/auth/profil')>('@/features/auth/profil')
  return { ...reel, chargerProfil: vi.fn() }
})

const profilSimule = vi.mocked(chargerProfil)

function profil(permissions: string[], roles: { code: string; name: string }[]) {
  profilSimule.mockResolvedValue({
    id: 'u1',
    username: 'diallo',
    last_name: 'Diallo',
    first_name: 'Amadou',
    roles,
    permissions,
    agence_courante: null,
    must_change_password: false,
  })
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<PageAccueil />} />
          <Route path="/utilisateurs" element={<div>Liste des utilisateurs</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('PageAccueil', () => {
  it('avec users.read : redirige vers la liste', async () => {
    profil(['users.read'], [{ code: 'ADMIN_FONCTIONNEL', name: 'Admin' }])
    afficher()

    expect(await screen.findByText('Liste des utilisateurs')).toBeVisible()
  })

  it('compte SANS RÔLE : message calme, pas d’erreur rouge', async () => {
    profil([], [])
    afficher()

    // Le message d'attente d'accès, informatif.
    expect(await screen.findByText(/pas encore de rôle attribué/i)).toBeVisible()
    expect(screen.getByText(/contactez votre administrateur/i)).toBeVisible()
    // Surtout PAS la liste, ni un refus de permission.
    expect(screen.queryByText('Liste des utilisateurs')).toBeNull()
    expect(screen.queryByText(/pas la permission/i)).toBeNull()
  })

  it('a un rôle mais pas users.read : message neutre, pas la liste', async () => {
    profil(['audit.read'], [{ code: 'AUDITEUR_INTERNE', name: 'Auditeur' }])
    afficher()

    expect(await screen.findByText(/écrans correspondant à votre rôle/i)).toBeVisible()
    expect(screen.queryByText('Liste des utilisateurs')).toBeNull()
  })

  it('accueille par le nom', async () => {
    profil([], [])
    afficher()

    expect(await screen.findByText(/bienvenue, amadou diallo/i)).toBeVisible()
  })
})
