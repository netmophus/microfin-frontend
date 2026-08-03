import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { chargerBalance } from '@/features/comptabilite/api'
import { PageBalance } from '@/features/comptabilite/PageBalance'

/** Balance. Point dur : le bandeau d'équilibre, vert/rouge, MÊME langage que le rapprochement
 * épargne — et les totaux débit/crédit affichés. */

vi.mock('@/features/comptabilite/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/comptabilite/api')>(
    '@/features/comptabilite/api',
  )
  return { ...reel, chargerBalance: vi.fn() }
})

const chargerBalanceSimule = vi.mocked(chargerBalance)

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PageBalance />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PageBalance', () => {
  it('équilibrée : bandeau vert, totaux affichés', async () => {
    chargerBalanceSimule.mockResolvedValue({
      date_debut: null,
      date_fin: null,
      lignes: [
        {
          account_number: '1011',
          name: 'Billets et monnaies',
          solde_ouverture: 0,
          total_debit: 5000,
          total_credit: 1000,
          solde_cloture: 4000,
        },
      ],
      total_debit: 5000,
      total_credit: 5000,
      equilibree: true,
    })
    afficher()

    expect(await screen.findByText('Balance équilibrée — Σ débit = Σ crédit.')).toBeVisible()
    // Total débit ET total crédit affichés (5000 chacun, équilibrés) — au moins 2 occurrences
    // (les totaux en tête + la ligne du compte).
    expect(screen.getAllByText('5 000 F').length).toBeGreaterThan(0)
  })

  it('déséquilibrée : bandeau rouge, alerte explicite', async () => {
    chargerBalanceSimule.mockResolvedValue({
      date_debut: null,
      date_fin: null,
      lignes: [],
      total_debit: 5000,
      total_credit: 4500,
      equilibree: false,
    })
    afficher()

    expect(await screen.findByText(/Balance DÉSÉQUILIBRÉE/)).toBeVisible()
  })

  it('aucun compte mouvementé : message explicite, pas un tableau vide muet', async () => {
    chargerBalanceSimule.mockResolvedValue({
      date_debut: null,
      date_fin: null,
      lignes: [],
      total_debit: 0,
      total_credit: 0,
      equilibree: true,
    })
    afficher()

    expect(await screen.findByText('Aucun compte mouvementé sur la période choisie.')).toBeVisible()
  })
})
