import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { deposerGuichet, rechercherCompte, retirerGuichet } from '@/features/epargne/api'
import { OngletGuichetEpargne } from '@/features/epargne/OngletGuichetEpargne'

/**
 * Onglet Épargne du guichet. Points durs : le NOM du titulaire est proéminent et RÉPÉTÉ à
 * la confirmation (vérification humaine contre une faute de frappe du numéro), la confirmation
 * est obligatoire avant l'opération, et un refus serveur s'affiche tel quel (message métier).
 */

vi.mock('@/features/epargne/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/epargne/api')>(
    '@/features/epargne/api',
  )
  return {
    ...reel,
    rechercherCompte: vi.fn(),
    deposerGuichet: vi.fn(),
    retirerGuichet: vi.fn(),
  }
})

const rechercheSimule = vi.mocked(rechercherCompte)
const depotSimule = vi.mocked(deposerGuichet)
const retraitSimule = vi.mocked(retirerGuichet)

function unCompte() {
  return {
    id: 'c1',
    account_number: 'EP-2026-0000001',
    tier_id: 't1',
    membre_nom: 'Traoré Fatoumata',
    product_name: 'Épargne à vue',
    product_type: 'a_vue',
    currency: 'XOF',
    balance: 7000,
    status: 'actif',
    is_provisional: true,
  }
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <OngletGuichetEpargne />
    </QueryClientProvider>,
  )
}

async function chercher() {
  fireEvent.change(screen.getByLabelText(/Numéro de compte/), {
    target: { value: 'EP-2026-0000001' },
  })
  fireEvent.click(screen.getByRole('button', { name: /Chercher/ }))
}

beforeEach(() => vi.clearAllMocks())

describe('OngletGuichetEpargne', () => {
  it('recherche : affiche le titulaire en évidence et le solde en francs', async () => {
    rechercheSimule.mockResolvedValue(unCompte())
    afficher()
    await chercher()

    expect(await screen.findByText('Traoré Fatoumata')).toBeVisible()
    expect(screen.getByText('7 000 F')).toBeVisible()
  })

  it('numéro inconnu : message clair, pas de silence', async () => {
    rechercheSimule.mockRejectedValue(
      new AxiosError('not found', undefined, undefined, undefined, {
        status: 404,
      } as never),
    )
    afficher()
    await chercher()

    expect(await screen.findByText(/Aucun compte à ce numéro/i)).toBeVisible()
  })

  it('dépôt : confirmation qui RÉPÈTE le nom, puis succès et solde mis à jour', async () => {
    rechercheSimule.mockResolvedValue(unCompte())
    depotSimule.mockResolvedValue({
      account_number: 'EP-2026-0000001',
      nouveau_solde: 17000,
      entry_number: 'CA-2026-000123',
    })
    afficher()
    await chercher()
    await screen.findByText('Traoré Fatoumata')

    fireEvent.click(screen.getByRole('button', { name: 'Dépôt' }))
    fireEvent.change(screen.getByLabelText(/Montant/), { target: { value: '10000' } })
    fireEvent.click(screen.getByRole('button', { name: /Continuer/ }))

    // La confirmation répète le nom du titulaire.
    expect(await screen.findByText(/Confirmez-vous l’opération pour Traoré Fatoumata/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))

    expect(await screen.findByText(/Dépôt de 10 000 F enregistré/)).toBeVisible()
    expect(screen.getByText(/Nouveau solde : 17 000 F/)).toBeVisible()
  })

  it('retrait refusé : le message serveur s’affiche tel quel', async () => {
    rechercheSimule.mockResolvedValue(unCompte())
    retraitSimule.mockRejectedValue(
      new AxiosError('rejet', undefined, undefined, undefined, {
        status: 422,
        data: { detail: 'Solde insuffisant : disponible 7 000 F' },
      } as never),
    )
    afficher()
    await chercher()
    await screen.findByText('Traoré Fatoumata')

    fireEvent.click(screen.getByRole('button', { name: 'Retrait' }))
    fireEvent.change(screen.getByLabelText(/Montant/), { target: { value: '10000' } })
    fireEvent.click(screen.getByRole('button', { name: /Continuer/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))

    await waitFor(() =>
      expect(screen.getByText(/Solde insuffisant : disponible 7 000 F/)).toBeVisible(),
    )
  })
})
