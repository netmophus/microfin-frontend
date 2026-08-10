import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listerSessionsManquantes } from '@/features/caisse/api'
import { PageSessionsManquantes } from '@/features/caisse/PageSessionsManquantes'

/**
 * Liste des manquants (retrouver une lettre plus tard). Points durs : le périmètre (les
 * siennes, ou plus large) est une décision SERVEUR — cet écran affiche ce qui revient sans
 * rien filtrer de plus ; chaque ligne mène à la lettre de la bonne session ; pagination.
 */

vi.mock('@/features/caisse/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/caisse/api')>('@/features/caisse/api')
  return { ...reel, listerSessionsManquantes: vi.fn() }
})

const listeSimulee = vi.mocked(listerSessionsManquantes)

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/caisse/manquants']}>
        <Routes>
          <Route path="/caisse/manquants" element={<PageSessionsManquantes />} />
          <Route path="/caisse/sessions/:id/lettre" element={<div>Lettre de {'ses-1'}</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const ligne = {
  id: 'ses-1',
  caissier_id: 'cai-1',
  caissier_nom: 'Awa Souley',
  agency_id: 'ag-1',
  agency_nom: 'Agence de Niamey',
  compte_caisse_number: '101111',
  fonds_initial: 40_000,
  opened_at: '2026-08-07T08:00:00Z',
  closed_at: '2026-08-07T18:00:00Z',
  montant_reel_cloture: 50_000,
  solde_theorique_cloture: 60_000,
  ecart: -10_000,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PageSessionsManquantes', () => {
  it('liste vide : le dit clairement', async () => {
    listeSimulee.mockResolvedValue({ lignes: [], total: 0, page: 1, taille: 25 })
    afficher()

    expect(await screen.findByText('Aucune session avec un manquant.')).toBeVisible()
  })

  it('affiche caissier, agence, date et écart (valeur absolue)', async () => {
    listeSimulee.mockResolvedValue({ lignes: [ligne], total: 1, page: 1, taille: 25 })
    afficher()

    expect(await screen.findByText('Awa Souley')).toBeVisible()
    expect(screen.getByText('Agence de Niamey')).toBeVisible()
    expect(screen.getByText('10 000 F')).toBeVisible()
  })

  it('un clic sur « Voir la lettre » mène à la lettre de la bonne session', async () => {
    listeSimulee.mockResolvedValue({ lignes: [ligne], total: 1, page: 1, taille: 25 })
    afficher()

    fireEvent.click(await screen.findByRole('link', { name: 'Voir la lettre' }))

    expect(await screen.findByText('Lettre de ses-1')).toBeVisible()
  })

  it('pagination : navigue vers la page suivante', async () => {
    listeSimulee.mockResolvedValue({ lignes: [ligne], total: 60, page: 1, taille: 25 })
    afficher()
    await screen.findByText('Awa Souley')

    expect(screen.getByRole('button', { name: 'Page précédente' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Page suivante' }))

    await waitFor(() => expect(listeSimulee).toHaveBeenCalledWith(2, 25))
  })

  it('erreur de chargement : affiche un message et un bouton Réessayer', async () => {
    listeSimulee.mockRejectedValue(new Error('réseau'))
    afficher()

    expect(
      await screen.findByText('Impossible de charger la liste des manquants.'),
    ).toBeVisible()
    const bouton = screen.getByRole('button', { name: 'Réessayer' })

    listeSimulee.mockResolvedValueOnce({ lignes: [], total: 0, page: 1, taille: 25 })
    fireEvent.click(bouton)

    expect(await screen.findByText('Aucune session avec un manquant.')).toBeVisible()
  })
})
