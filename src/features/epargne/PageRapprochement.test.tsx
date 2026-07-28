import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { chargerRapprochement } from '@/features/epargne/api'
import { PageRapprochement } from '@/features/epargne/PageRapprochement'

/**
 * Vue de rapprochement. Point dur : concordant en vert, écart en rouge AVEC le montant, et un
 * bandeau de synthèse qui alerte dès qu'un seul compte ne concorde pas.
 */

vi.mock('@/features/epargne/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/epargne/api')>(
    '@/features/epargne/api',
  )
  return { ...reel, chargerRapprochement: vi.fn() }
})

const rapprochementSimule = vi.mocked(chargerRapprochement)

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PageRapprochement />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PageRapprochement', () => {
  it('signale un écart (rouge, avec le montant) et alerte dans la synthèse', async () => {
    rapprochementSimule.mockResolvedValue([
      { compte_general: '3111', auxiliaire: 1250000, general: 1250000, concordant: true, ecart: 0 },
      { compte_general: '3121', auxiliaire: 800000, general: 799500, concordant: false, ecart: 500 },
    ])
    afficher()

    expect(await screen.findByText('Concordant')).toBeVisible()
    // L'écart affiche le MONTANT.
    expect(screen.getByText(/Écart : 500 F/)).toBeVisible()
    // La synthèse alerte dès qu'un compte ne concorde pas.
    expect(screen.getByText(/Au moins un écart détecté/)).toBeVisible()
  })

  it('tout concorde : synthèse rassurante', async () => {
    rapprochementSimule.mockResolvedValue([
      { compte_general: '3111', auxiliaire: 1250000, general: 1250000, concordant: true, ecart: 0 },
    ])
    afficher()

    expect(await screen.findByText('Tous les comptes concordent.')).toBeVisible()
  })
})
