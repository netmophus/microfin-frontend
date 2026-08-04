import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listerDemandesCredit } from '@/features/credit/api'
import { PageCredit } from '@/features/credit/PageCredit'

/** Liste réseau des dossiers de crédit. Points durs : le filtre par statut, et une liste vide
 * qui le DIT plutôt que de rester une page blanche. */

vi.mock('@/features/credit/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/credit/api')>(
    '@/features/credit/api',
  )
  return { ...reel, listerDemandesCredit: vi.fn() }
})

const demandesSimulees = vi.mocked(listerDemandesCredit)

function unDossier(o: Partial<ReturnType<typeof base>> = {}) {
  return { ...base(), ...o }
}
function base() {
  return {
    id: 'd1',
    application_number: 'CR-2026-0000001',
    tier_number: 'M-2026-0000001',
    tier_nom: 'Diallo Amadou',
    product_code: 'CRT1',
    product_name: 'Crédit court terme',
    montant_demande: 500000,
    duree_echeances: 12,
    status: 'en_instruction',
    created_at: '2026-08-04T10:00:00Z',
  }
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PageCredit />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('PageCredit', () => {
  it('liste tous les dossiers avec leur statut', async () => {
    demandesSimulees.mockResolvedValue([
      unDossier(),
      unDossier({ id: 'd2', application_number: 'CR-2026-0000002', status: 'decaisse' }),
    ])
    afficher()

    expect(await screen.findByText('CR-2026-0000001')).toBeVisible()
    expect(screen.getByText('CR-2026-0000002')).toBeVisible()
    // « En instruction » et « Décaissée » apparaissent aussi dans les <option> du filtre :
    // on cible les badges dans le tableau.
    const table = screen.getByRole('table')
    expect(within(table).getByText('En instruction')).toBeVisible()
    expect(within(table).getByText('Décaissée')).toBeVisible()
  })

  it('filtre par statut', async () => {
    demandesSimulees.mockResolvedValue([
      unDossier(),
      unDossier({ id: 'd2', application_number: 'CR-2026-0000002', status: 'decaisse' }),
    ])
    afficher()

    await screen.findByText('CR-2026-0000001')
    fireEvent.change(screen.getByLabelText('Filtrer par statut'), {
      target: { value: 'decaisse' },
    })

    expect(screen.queryByText('CR-2026-0000001')).toBeNull()
    expect(screen.getByText('CR-2026-0000002')).toBeVisible()
  })

  it('aucun dossier : le dit, pas une page blanche', async () => {
    demandesSimulees.mockResolvedValue([])
    afficher()

    expect(await screen.findByText('Aucun dossier de crédit pour ce filtre.')).toBeVisible()
  })
})
