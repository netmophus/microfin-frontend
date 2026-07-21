import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ErreurListe, listerUtilisateurs, type LigneUtilisateur } from '@/features/utilisateurs/api'
import { PageUtilisateurs } from '@/features/utilisateurs/PageUtilisateurs'

/**
 * Liste des utilisateurs — les états qu'un tableau de données doit distinguer.
 *
 * Le contrat de GET /users (forme { lignes, total, page, taille }, 403 sans users.read) a
 * été défini côté serveur. Ici on vérifie la TRADUCTION en écran : un tableau vide sans
 * message ressemble à une panne, et un 403 affiché comme une erreur générique cacherait
 * qu'il s'agit d'un manque de permission.
 */

vi.mock('@/features/utilisateurs/api', async () => {
  const reel =
    await vi.importActual<typeof import('@/features/utilisateurs/api')>(
      '@/features/utilisateurs/api',
    )
  return { ...reel, listerUtilisateurs: vi.fn() }
})

const listerSimule = vi.mocked(listerUtilisateurs)

function ligne(nom: string, actif = true, verrouille = false): LigneUtilisateur {
  return {
    id: crypto.randomUUID(),
    matricule: `MAT-${nom}`,
    username: nom.toLowerCase(),
    email: `${nom.toLowerCase()}@imf.local`,
    last_name: nom,
    first_name: 'Test',
    agence: null,
    is_active: actif,
    is_locked: verrouille,
  }
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PageUtilisateurs />
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('PageUtilisateurs', () => {
  it('affiche les lignes reçues du serveur', async () => {
    listerSimule.mockResolvedValue({
      lignes: [ligne('Diallo'), ligne('Traoré')],
      total: 2,
      page: 1,
      taille: 25,
    })

    afficher()

    expect(await screen.findByText('Diallo')).toBeVisible()
    expect(screen.getByText('Traoré')).toBeVisible()
    expect(screen.getByText(/2 utilisateurs/i)).toBeVisible()
  })

  it('distingue le statut : verrouillé prime sur inactif', async () => {
    listerSimule.mockResolvedValue({
      lignes: [ligne('Sow'), ligne('Bah', false), ligne('Kone', false, true)],
      total: 3,
      page: 1,
      taille: 25,
    })

    afficher()

    // Trois lignes, trois pastilles de statut distinctes.
    expect(await screen.findByText('Actif')).toBeVisible()
    expect(screen.getByText('Inactif')).toBeVisible()
    // Le compte inactif ET verrouillé (Kone) est signalé « Verrouillé », le cas urgent.
    expect(screen.getByText('Verrouillé')).toBeVisible()
  })

  it('base vide : message d’amorçage, pas un tableau vide', async () => {
    listerSimule.mockResolvedValue({ lignes: [], total: 0, page: 1, taille: 25 })

    afficher()

    expect(await screen.findByText(/aucun utilisateur pour l’instant/i)).toBeVisible()
  })

  it('recherche sans résultat : message DIFFÉRENT de la base vide', async () => {
    listerSimule.mockResolvedValue({ lignes: [], total: 0, page: 1, taille: 25 })

    afficher()
    await userEvent.setup().type(screen.getByLabelText(/rechercher/i), 'introuvable')

    expect(await screen.findByText(/ne correspond à votre recherche/i)).toBeVisible()
  })

  it('403 : nomme le manque de permission, pas une panne générique', async () => {
    listerSimule.mockRejectedValue(new ErreurListe({ type: 'interdit' }))

    afficher()

    expect(await screen.findByRole('alert')).toHaveTextContent(/pas la permission/i)
  })

  it('panne réseau : message distinct', async () => {
    listerSimule.mockRejectedValue(new ErreurListe({ type: 'reseau' }))

    afficher()

    expect(await screen.findByRole('alert')).toHaveTextContent(/serveur ne répond pas/i)
  })

  it('la recherche est transmise au serveur (paramètre q)', async () => {
    listerSimule.mockResolvedValue({ lignes: [], total: 0, page: 1, taille: 25 })

    afficher()
    await userEvent.setup().type(screen.getByLabelText(/rechercher/i), 'Kane')

    // Le debounce diffère l'appel ; on attend qu'il parte avec le terme saisi.
    await waitFor(() =>
      expect(listerSimule).toHaveBeenCalledWith(expect.objectContaining({ q: 'Kane' })),
    )
  })
})
