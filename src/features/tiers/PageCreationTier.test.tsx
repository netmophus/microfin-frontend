import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PageCreationTier } from '@/features/tiers/PageCreationTier'

/**
 * Création — le premier formulaire du projet dont la STRUCTURE varie selon un choix.
 * On vérifie qu'un changement de type démonte l'ancien formulaire (pas de champ résiduel).
 */

vi.mock('@/features/auth/useProfil', () => ({
  useProfil: () => ({ data: { permissions: [] } }),
  useAPermission: () => false, // pas de portée réseau -> pas de sélecteur d'agence
}))

vi.mock('@/features/tiers/referentiels', () => ({
  listerPays: vi.fn().mockResolvedValue([]),
  listerDevises: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/features/utilisateurs/agences', () => ({
  listerAgences: vi.fn().mockResolvedValue([]),
}))

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PageCreationTier />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('PageCreationTier', () => {
  it('affiche par défaut le formulaire personne physique', () => {
    afficher()

    expect(screen.getByLabelText('Nom')).toBeVisible()
    expect(screen.getByLabelText('Prénom')).toBeVisible()
    expect(screen.getByLabelText('Nationalité')).toBeVisible()
  })

  it('changer de type change la structure et n’en laisse rien traîner', async () => {
    const user = userEvent.setup()
    afficher()

    // Personne morale : ses champs apparaissent, ceux de la personne physique disparaissent.
    await user.click(screen.getByText('Personne morale'))
    expect(screen.getByLabelText('Dénomination sociale')).toBeVisible()
    expect(screen.getByLabelText('Forme juridique')).toBeVisible()
    expect(screen.queryByLabelText('Prénom')).toBeNull()
    expect(screen.queryByLabelText('Nationalité')).toBeNull()

    // Groupement : encore une autre structure.
    await user.click(screen.getByText('Groupement'))
    expect(screen.getByLabelText('Nom du groupement')).toBeVisible()
    expect(screen.queryByLabelText('Dénomination sociale')).toBeNull()
  })
})
