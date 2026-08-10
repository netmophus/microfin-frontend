import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { lireSession } from '@/features/caisse/api'
import { PageLettreExplication } from '@/features/caisse/PageLettreExplication'

/**
 * Lettre de demande d'explication (manquant de caisse). Points durs : garde-fou — jamais
 * fabriquée pour une session sans manquant (écart nul, excédent, ou encore ouverte), même en
 * accédant directement par l'URL ; le document affiche l'identité en clair (caissier, agence),
 * le calcul complet, et le texte formel avec le bon montant.
 */

vi.mock('@/features/caisse/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/caisse/api')>('@/features/caisse/api')
  return { ...reel, lireSession: vi.fn() }
})

const lectureSimulee = vi.mocked(lireSession)

function afficher(id = 'ses-1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/caisse/sessions/${id}/lettre`]}>
        <Routes>
          <Route path="/caisse/sessions/:id/lettre" element={<PageLettreExplication />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const sessionManquante = {
  id: 'ses-1',
  agency_id: 'ag-1',
  agency_nom: 'Agence de Niamey',
  caissier_id: 'cai-1',
  caissier_nom: 'Awa Souley',
  compte_caisse_number: '101111',
  fonds_initial: 40_000,
  opened_at: '2026-08-07T08:00:00Z',
  closed_at: '2026-08-07T18:00:00Z',
  solde_theorique_actuel: null,
  montant_reel_cloture: 50_000,
  solde_theorique_cloture: 60_000,
  ecart: -10_000,
  status: 'fermee' as const,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PageLettreExplication', () => {
  it('affiche le document avec identité, calcul et texte formel', async () => {
    lectureSimulee.mockResolvedValue(sessionManquante)
    afficher()

    expect(await screen.findByText('Awa Souley')).toBeVisible()
    expect(screen.getByText('Agence de Niamey')).toBeVisible()
    expect(screen.getByText('101111')).toBeVisible()
    expect(screen.getByText('40 000 F')).toBeVisible() // fonds initial
    expect(screen.getByText('60 000 F')).toBeVisible() // solde théorique de clôture
    expect(screen.getByText('50 000 F')).toBeVisible() // montant compté
    expect(screen.getByText('10 000 F')).toBeVisible() // écart, en valeur absolue
    expect(screen.getByText(/Un manquant de 10 000 F a été constaté/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Imprimer' })).toBeVisible()
  })

  it('écart nul : refuse de fabriquer une lettre', async () => {
    lectureSimulee.mockResolvedValue({ ...sessionManquante, ecart: 0 })
    afficher()

    expect(
      await screen.findByText(/Cette session n’a pas de manquant/),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Imprimer' })).toBeNull()
  })

  it('excédent : refuse de fabriquer une lettre (hors périmètre)', async () => {
    lectureSimulee.mockResolvedValue({ ...sessionManquante, ecart: 5_000 })
    afficher()

    expect(await screen.findByText(/Cette session n’a pas de manquant/)).toBeVisible()
  })

  it('session encore ouverte : refuse (pas de manquant tant que rien n’est figé)', async () => {
    lectureSimulee.mockResolvedValue({
      ...sessionManquante, status: 'ouverte', ecart: null, closed_at: null,
    })
    afficher()

    expect(await screen.findByText(/Cette session n’a pas de manquant/)).toBeVisible()
  })

  it('erreur de chargement : affiche un message et un bouton Réessayer', async () => {
    lectureSimulee.mockRejectedValue(new Error('réseau'))
    afficher()

    expect(await screen.findByText('Impossible de charger cette session.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeVisible()
  })
})
