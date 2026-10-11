import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { creerGroupement, creerPersonneMorale, type FicheTier } from '@/features/tiers/api'
import { PageCreationTier } from '@/features/tiers/PageCreationTier'

/**
 * Création — le premier formulaire du projet dont la STRUCTURE varie selon un choix.
 * On vérifie qu'un changement de type démonte l'ancien formulaire (pas de champ résiduel).
 */

vi.mock('@/features/auth/useProfil', () => ({
  useProfil: () => ({ data: { permissions: [] } }),
  useAPermission: () => false, // pas de portée réseau -> pas de sélecteur d'agence
}))

vi.mock('@/features/tiers/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/tiers/api')>('@/features/tiers/api')
  return { ...reel, creerPersonneMorale: vi.fn(), creerGroupement: vi.fn() }
})

vi.mock('@/features/tiers/referentiels', () => ({
  listerPays: vi.fn().mockResolvedValue([{ id: 'pays-ne', code: 'NE', name: 'Niger' }]),
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

  it('la création d’une personne morale accepte nom commercial, RCCM, NIF et objet', async () => {
    const user = userEvent.setup()
    vi.mocked(creerPersonneMorale).mockResolvedValue({ id: 'nouveau' } as FicheTier)
    afficher()

    await user.click(screen.getByText('Personne morale'))
    await user.type(screen.getByLabelText('Dénomination sociale'), 'TANDA SERVICES')
    await user.selectOptions(screen.getByLabelText('Forme juridique'), 'SARL')
    await user.type(screen.getByLabelText('Date de constitution'), '2020-03-15')
    await user.selectOptions(await screen.findByLabelText('Pays du siège'), 'pays-ne')
    await user.type(screen.getByLabelText('Nom commercial (facultatif)'), ' Tanda ')
    await user.type(screen.getByLabelText('Numéro RCCM (facultatif)'), 'NI-NIA-2020-B-0042')
    await user.type(screen.getByLabelText('NIF (facultatif)'), 'NIF-123')
    await user.type(screen.getByLabelText('Objet social (facultatif)'), 'Négoce de céréales')
    await user.click(screen.getByRole('button', { name: 'Créer la fiche' }))

    await waitFor(() => expect(creerPersonneMorale).toHaveBeenCalledTimes(1))
    expect(creerPersonneMorale).toHaveBeenCalledWith(
      expect.objectContaining({
        legal_name: 'TANDA SERVICES',
        commercial_name: 'Tanda',
        rccm_number: 'NI-NIA-2020-B-0042',
        nif_number: 'NIF-123',
        business_purpose: 'Négoce de céréales',
      }),
    )
  })

  it('les champs facultatifs d’une personne morale laissés vides partent en absence de valeur', async () => {
    const user = userEvent.setup()
    vi.mocked(creerPersonneMorale).mockResolvedValue({ id: 'nouveau' } as FicheTier)
    afficher()

    await user.click(screen.getByText('Personne morale'))
    await user.type(screen.getByLabelText('Dénomination sociale'), 'SARL SIMPLE')
    await user.selectOptions(screen.getByLabelText('Forme juridique'), 'SARL')
    await user.type(screen.getByLabelText('Date de constitution'), '2020-03-15')
    await user.selectOptions(await screen.findByLabelText('Pays du siège'), 'pays-ne')
    await user.click(screen.getByRole('button', { name: 'Créer la fiche' }))

    await waitFor(() => expect(creerPersonneMorale).toHaveBeenCalledTimes(1))
    expect(creerPersonneMorale).toHaveBeenCalledWith(
      expect.objectContaining({
        commercial_name: null,
        rccm_number: null,
        nif_number: null,
        business_purpose: null,
      }),
    )
  })

  it('la création d’un groupement accepte zone, objet et effectif', async () => {
    const user = userEvent.setup()
    vi.mocked(creerGroupement).mockResolvedValue({ id: 'nouveau' } as FicheTier)
    afficher()

    await user.click(screen.getByText('Groupement'))
    await user.type(screen.getByLabelText('Nom du groupement'), 'HASKE')
    await user.selectOptions(screen.getByLabelText('Type de groupement'), 'tontine')
    await user.type(screen.getByLabelText('Date de constitution'), '2019-06-01')
    await user.type(screen.getByLabelText('Zone d’intervention (facultatif)'), 'Commune de Tahoua')
    await user.type(screen.getByLabelText('Objet du groupement (facultatif)'), 'Épargne et entraide')
    await user.type(screen.getByLabelText('Effectif prévu (facultatif)'), '25')
    await user.click(screen.getByRole('button', { name: 'Créer la fiche' }))

    await waitFor(() => expect(creerGroupement).toHaveBeenCalledTimes(1))
    expect(creerGroupement).toHaveBeenCalledWith(
      expect.objectContaining({
        group_name: 'HASKE',
        intervention_zone: 'Commune de Tahoua',
        group_purpose: 'Épargne et entraide',
        expected_member_count: 25,
      }),
    )
  })

  it('un effectif invalide est signalé sous le champ, rien n’est envoyé', async () => {
    const user = userEvent.setup()
    afficher()

    await user.click(screen.getByText('Groupement'))
    await user.type(screen.getByLabelText('Nom du groupement'), 'HASKE')
    await user.selectOptions(screen.getByLabelText('Type de groupement'), 'tontine')
    await user.type(screen.getByLabelText('Date de constitution'), '2019-06-01')
    await user.type(screen.getByLabelText('Effectif prévu (facultatif)'), '0')
    await user.click(screen.getByRole('button', { name: 'Créer la fiche' }))

    expect(await screen.findByText('Indiquez un nombre entier supérieur à zéro.')).toBeVisible()
    expect(creerGroupement).not.toHaveBeenCalled()
  })
})
