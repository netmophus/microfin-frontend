import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { creerUtilisateur, ErreurCreation } from '@/features/utilisateurs/api'
import { listerAgences } from '@/features/utilisateurs/agences'
import { PageCreationUtilisateur } from '@/features/utilisateurs/PageCreationUtilisateur'

/**
 * Formulaire de création — et surtout l'écran du mot de passe provisoire.
 *
 * Le point crucial : ce mot de passe n'est affiché qu'une fois. L'utilisateur DOIT confirmer
 * explicitement qu'il l'a noté avant de pouvoir fermer. Un test vérifie que le bouton de
 * fermeture reste inactif tant que la case n'est pas cochée.
 */

vi.mock('@/features/utilisateurs/api', async () => {
  const reel =
    await vi.importActual<typeof import('@/features/utilisateurs/api')>('@/features/utilisateurs/api')
  return { ...reel, creerUtilisateur: vi.fn() }
})
vi.mock('@/features/utilisateurs/agences', () => ({ listerAgences: vi.fn() }))

const creerSimule = vi.mocked(creerUtilisateur)
const agencesSimule = vi.mocked(listerAgences)

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/utilisateurs/nouveau']}>
        <Routes>
          <Route path="/utilisateurs/nouveau" element={<PageCreationUtilisateur />} />
          <Route path="/" element={<div>Liste</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function remplirFormulaire() {
  const u = userEvent.setup()
  await u.type(screen.getByLabelText(/matricule/i), 'MAT-001')
  await u.type(screen.getByLabelText(/^nom$/i), 'Diallo')
  await u.type(screen.getByLabelText(/prénom/i), 'Amadou')
  await u.type(screen.getByLabelText(/identifiant/i), 'adiallo')
  await u.type(screen.getByLabelText(/adresse électronique/i), 'a.diallo@imf.local')
  await u.selectOptions(screen.getByLabelText(/agence/i), 'ag-1')
  await u.click(screen.getByRole('button', { name: /créer le compte/i }))
}

beforeEach(() => {
  vi.clearAllMocks()
  agencesSimule.mockResolvedValue([{ id: 'ag-1', code: 'AG-001', name: 'Siège' }])
})

describe('PageCreationUtilisateur', () => {
  it('charge les agences dans le sélecteur', async () => {
    afficher()
    expect(await screen.findByRole('option', { name: 'Siège' })).toBeInTheDocument()
  })

  it('valide la présence des champs sans appeler le serveur', async () => {
    afficher()
    await userEvent.setup().click(screen.getByRole('button', { name: /créer le compte/i }))

    expect(await screen.findByText(/matricule est obligatoire/i)).toBeVisible()
    expect(creerSimule).not.toHaveBeenCalled()
  })

  it('exige une agence (règle métier : pas de compte orphelin)', async () => {
    const u = userEvent.setup()
    afficher()
    await u.type(screen.getByLabelText(/matricule/i), 'MAT-001')
    await u.type(screen.getByLabelText(/^nom$/i), 'Diallo')
    await u.type(screen.getByLabelText(/prénom/i), 'Amadou')
    await u.type(screen.getByLabelText(/identifiant/i), 'adiallo')
    await u.type(screen.getByLabelText(/adresse électronique/i), 'a.diallo@imf.local')
    // agence NON sélectionnée
    await u.click(screen.getByRole('button', { name: /créer le compte/i }))

    expect(await screen.findByText(/choisissez une agence/i)).toBeVisible()
    expect(creerSimule).not.toHaveBeenCalled()
  })

  it('après succès : montre le mot de passe, et le bouton de sortie reste BLOQUÉ tant que non confirmé', async () => {
    creerSimule.mockResolvedValue({
      utilisateur: { id: 'u1', last_name: 'Diallo', first_name: 'Amadou', username: 'adiallo' },
      motDePasseProvisoire: 'Provisoire!2027xY',
    })

    afficher()
    await remplirFormulaire()

    // Le mot de passe est affiché en clair, une fois.
    expect(await screen.findByText('Provisoire!2027xY')).toBeVisible()

    // LE point crucial : sortir est impossible tant qu'on n'a pas confirmé l'avoir noté.
    const sortie = screen.getByRole('button', { name: /terminer/i })
    expect(sortie).toBeDisabled()

    await userEvent.setup().click(screen.getByRole('checkbox'))
    expect(sortie).toBeEnabled()
  })

  it('confirmé, le bouton ramène à la liste', async () => {
    creerSimule.mockResolvedValue({
      utilisateur: { id: 'u1', last_name: 'Diallo', first_name: 'Amadou', username: 'adiallo' },
      motDePasseProvisoire: 'Provisoire!2027xY',
    })

    afficher()
    await remplirFormulaire()
    const u = userEvent.setup()
    await u.click(await screen.findByRole('checkbox'))
    await u.click(screen.getByRole('button', { name: /terminer/i }))

    expect(await screen.findByText('Liste')).toBeVisible()
  })

  it('409 : signale un identifiant déjà utilisé', async () => {
    creerSimule.mockRejectedValue(new ErreurCreation({ type: 'conflit' }))

    afficher()
    await remplirFormulaire()

    expect(await screen.findByRole('alert')).toHaveTextContent(/déjà utilisé/i)
  })

  it('422 : signale des informations invalides', async () => {
    creerSimule.mockRejectedValue(new ErreurCreation({ type: 'invalide' }))

    afficher()
    await remplirFormulaire()

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalides/i)
  })
})
