import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as ficheApi from '@/features/utilisateurs/fiche-api'
import { SectionRoles } from '@/features/utilisateurs/SectionRoles'

/**
 * Section Rôles — l'affichage, l'édition, et la lecture seule sur sa propre fiche.
 */

vi.mock('@/features/utilisateurs/fiche-api', async () => {
  const reel =
    await vi.importActual<typeof import('@/features/utilisateurs/fiche-api')>(
      '@/features/utilisateurs/fiche-api',
    )
  return { ...reel, listerRoles: vi.fn(), attribuerRole: vi.fn(), retirerRole: vi.fn() }
})

const listerRoles = vi.mocked(ficheApi.listerRoles)
const attribuerRole = vi.mocked(ficheApi.attribuerRole)

function fiche(roles: { code: string; name: string }[]): ficheApi.Fiche {
  return {
    id: 'u-1',
    matricule: 'MAT-1',
    username: 'u1',
    email: 'u1@imf.local',
    phone: null,
    last_name: 'Diallo',
    first_name: 'A',
    agence_principale: null,
    agences_habilitees: [],
    roles,
    is_active: true,
    is_locked: false,
    locked_until: null,
    must_change_password: false,
    created_at: '2026-07-01T09:00:00Z',
    updated_at: '2026-07-01T09:00:00Z',
  }
}

function afficher(props: Parameters<typeof SectionRoles>[0]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <SectionRoles {...props} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  listerRoles.mockResolvedValue([
    { code: 'CAISSIER', name: 'Caissier', description: null },
    { code: 'COMPTABLE', name: 'Comptable', description: null },
  ])
})

describe('SectionRoles', () => {
  it('affiche les rôles actuels', () => {
    afficher({ fiche: fiche([{ code: 'CAISSIER', name: 'Caissier' }]), modifiable: true })
    expect(screen.getByText('Caissier')).toBeVisible()
  })

  it('signale un compte sans rôle comme inutilisable', () => {
    afficher({ fiche: fiche([]), modifiable: true })
    expect(screen.getByText(/ne peut rien faire/i)).toBeVisible()
  })

  it('ne propose à l’ajout que les rôles non détenus', async () => {
    afficher({ fiche: fiche([{ code: 'CAISSIER', name: 'Caissier' }]), modifiable: true })

    // Le sélecteur ne doit proposer que Comptable (Caissier est déjà détenu).
    expect(await screen.findByRole('option', { name: 'Comptable' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Caissier' })).toBeNull()
  })

  it('attribue le rôle choisi', async () => {
    attribuerRole.mockResolvedValue(fiche([{ code: 'CAISSIER', name: 'Caissier' }]))
    afficher({ fiche: fiche([{ code: 'CAISSIER', name: 'Caissier' }]), modifiable: true })

    const u = userEvent.setup()
    // Attendre que les rôles disponibles soient chargés (le sélecteur est désactivé tant
    // que la requête est en cours).
    await screen.findByRole('option', { name: 'Comptable' })
    await u.selectOptions(screen.getByLabelText(/ajouter un rôle/i), 'COMPTABLE')
    await u.click(screen.getByRole('button', { name: /attribuer/i }))

    expect(attribuerRole).toHaveBeenCalledWith('u-1', 'COMPTABLE')
  })

  it('en lecture seule : pas de contrôle d’édition, mais l’explication', () => {
    afficher({
      fiche: fiche([{ code: 'CAISSIER', name: 'Caissier' }]),
      modifiable: false,
      motifLectureSeule: 'On ne modifie pas ses propres rôles.',
    })

    expect(screen.getByText('Caissier')).toBeVisible()
    expect(screen.queryByRole('button', { name: /attribuer/i })).toBeNull()
    expect(screen.queryByLabelText(/retirer/i)).toBeNull()
    expect(screen.getByText(/ses propres rôles/i)).toBeVisible()
  })
})
