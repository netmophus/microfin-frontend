import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { chargerProfil } from '@/features/auth/profil'
import * as ficheApi from '@/features/utilisateurs/fiche-api'
import { PageFicheUtilisateur } from '@/features/utilisateurs/PageFicheUtilisateur'

/**
 * Fiche détaillée — surtout la matrice permissions × soi-même, et le verrou du mot de passe
 * réinitialisé (identique à la création).
 */

vi.mock('@/features/auth/profil', () => ({ chargerProfil: vi.fn(), nomAffiche: vi.fn() }))
vi.mock('@/features/utilisateurs/fiche-api', async () => {
  const reel =
    await vi.importActual<typeof import('@/features/utilisateurs/fiche-api')>(
      '@/features/utilisateurs/fiche-api',
    )
  return {
    ...reel,
    chargerFiche: vi.fn(),
    reinitialiserMotDePasse: vi.fn(),
    supprimer: vi.fn(),
  }
})

const profilSimule = vi.mocked(chargerProfil)
const chargerFiche = vi.mocked(ficheApi.chargerFiche)
const reinit = vi.mocked(ficheApi.reinitialiserMotDePasse)

const FICHE: ficheApi.Fiche = {
  id: 'u-42',
  matricule: 'MAT-042',
  username: 'adiallo',
  email: 'a.diallo@imf.local',
  phone: '70000000',
  last_name: 'Diallo',
  first_name: 'Amadou',
  agence_principale: { id: 'ag-1', code: 'AG-001', name: 'Siège' },
  agences_habilitees: [],
  roles: [],
  is_active: true,
  is_locked: false,
  locked_until: null,
  must_change_password: false,
  created_at: '2026-07-01T09:00:00Z',
  updated_at: '2026-07-15T14:30:00Z',
}

const TOUTES = [
  'users.read',
  'users.update',
  'users.delete',
  'users.unlock',
  'users.reset_password',
  'perimetre.reseau',
]

function profil(id: string, permissions: string[]) {
  profilSimule.mockResolvedValue({
    id,
    username: 'moi',
    last_name: 'M',
    first_name: 'M',
    roles: [],
    permissions,
    agence_courante: null,
    must_change_password: false,
  })
}

function afficher(ficheId = 'u-42') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/utilisateurs/${ficheId}`]}>
        <Routes>
          <Route path="/utilisateurs/:id" element={<PageFicheUtilisateur />} />
          <Route path="/" element={<div>Liste</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  chargerFiche.mockResolvedValue(FICHE)
})

describe('PageFicheUtilisateur', () => {
  it('affiche les informations de la personne', async () => {
    profil('moi', TOUTES)
    afficher()

    expect(await screen.findByText('MAT-042')).toBeVisible()
    expect(screen.getByText('a.diallo@imf.local')).toBeVisible()
    expect(screen.getByText('Siège')).toBeVisible()
  })

  it('sans permission : aucun bouton d’action', async () => {
    profil('moi', ['users.read'])
    afficher()

    await screen.findByText('MAT-042')
    expect(screen.queryByRole('button', { name: /modifier/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /désactiver/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /supprimer/i })).toBeNull()
  })

  it('avec toutes les permissions : les actions apparaissent', async () => {
    profil('moi', TOUTES)
    afficher()

    await screen.findByText('MAT-042')
    expect(screen.getByRole('button', { name: /modifier/i })).toBeVisible()
    expect(screen.getByRole('button', { name: /désactiver/i })).toBeVisible()
    expect(screen.getByRole('button', { name: /réinitialiser/i })).toBeVisible()
    expect(screen.getByRole('button', { name: /^supprimer$/i })).toBeVisible()
  })

  it('sur SON PROPRE compte : ni désactiver, ni supprimer, mais modifier reste', async () => {
    // La fiche est celle de l'utilisateur connecté.
    profil('u-42', TOUTES)
    afficher('u-42')

    await screen.findByText('MAT-042')
    expect(screen.getByRole('button', { name: /modifier/i })).toBeVisible()
    expect(screen.queryByRole('button', { name: /désactiver/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^supprimer$/i })).toBeNull()
    expect(screen.getByText(/sur votre propre compte/i)).toBeVisible()
  })

  it('supprimer exige la portée réseau, pas seulement users.delete', async () => {
    profil('moi', ['users.read', 'users.delete']) // delete sans perimetre.reseau
    afficher()

    await screen.findByText('MAT-042')
    expect(screen.queryByRole('button', { name: /^supprimer$/i })).toBeNull()
  })

  it('déverrouiller n’apparaît que si le compte est verrouillé', async () => {
    chargerFiche.mockResolvedValue({ ...FICHE, is_locked: true, locked_until: '2026-07-20T12:00:00Z' })
    profil('moi', TOUTES)
    afficher()

    await screen.findByText('MAT-042')
    expect(screen.getByRole('button', { name: /déverrouiller/i })).toBeVisible()
  })

  it('désactiver demande confirmation en prévenant de la déconnexion', async () => {
    profil('moi', TOUTES)
    afficher()

    await screen.findByText('MAT-042')
    await userEvent.setup().click(screen.getByRole('button', { name: /désactiver/i }))

    expect(await screen.findByText(/immédiatement déconnectée/i)).toBeVisible()
  })

  it('supprimer demande une confirmation explicite (pas un simple OK)', async () => {
    profil('moi', TOUTES)
    afficher()

    await screen.findByText('MAT-042')
    await userEvent.setup().click(screen.getByRole('button', { name: /^supprimer$/i }))

    expect(await screen.findByText(/suppression logique/i)).toBeVisible()
    expect(screen.getByRole('button', { name: /supprimer définitivement/i })).toBeVisible()
  })

  it('réinitialiser révèle le mot de passe avec le MÊME verrou qu’à la création', async () => {
    profil('moi', TOUTES)
    reinit.mockResolvedValue('Reinit!2027abc')
    afficher()

    const u = userEvent.setup()
    await screen.findByText('MAT-042')
    await u.click(screen.getByRole('button', { name: /réinitialiser/i }))
    // Confirmation (prévient de la révocation des sessions).
    expect(await screen.findByText(/sessions.*révoquées/i)).toBeVisible()
    await u.click(screen.getByRole('button', { name: /^réinitialiser le mot de passe$/i }))

    // Le mot de passe est affiché, et la sortie reste bloquée jusqu'à confirmation.
    expect(await screen.findByText('Reinit!2027abc')).toBeVisible()
    const sortie = screen.getByRole('button', { name: /terminer/i })
    expect(sortie).toBeDisabled()
    await u.click(screen.getByRole('checkbox'))
    expect(sortie).toBeEnabled()
  })
})
