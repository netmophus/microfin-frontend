import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listerComptesMembre } from '@/features/epargne/api'
import { OngletComptesEpargne } from '@/features/epargne/OngletComptesEpargne'

/**
 * Onglet Comptes d'épargne — le premier écran du module. Points durs : l'ouverture n'apparaît que
 * pour un membre ACTIF (le gate KYC est EXPLIQUÉ à l'écran pour un prospect), le solde s'affiche
 * clairement en francs, et un produit provisoire est signalé.
 */

const etat = vi.hoisted(() => ({ permissions: ['epargne.account.open'] as string[] }))

vi.mock('@/features/auth/useProfil', () => ({
  useAPermission: (p: string) => etat.permissions.includes(p),
}))

vi.mock('@/features/epargne/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/epargne/api')>(
    '@/features/epargne/api',
  )
  return { ...reel, listerComptesMembre: vi.fn(), listerProduits: vi.fn(), ouvrirCompte: vi.fn() }
})

const comptesSimules = vi.mocked(listerComptesMembre)

function unCompte() {
  return {
    id: 'c1',
    account_number: 'EP-2026-0000001',
    product_code: 'EAV',
    product_name: 'Épargne à vue',
    product_type: 'a_vue',
    currency: 'XOF',
    balance: 110000,
    status: 'actif',
    is_provisional: true,
  }
}

function afficher(statut: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <OngletComptesEpargne tierId="t1" tierStatut={statut} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.permissions = ['epargne.account.open']
})

describe('OngletComptesEpargne', () => {
  it('membre actif : liste les comptes (solde en francs) et propose l’ouverture', async () => {
    comptesSimules.mockResolvedValue([unCompte()])
    afficher('actif')

    expect(await screen.findByText('EP-2026-0000001')).toBeVisible()
    // Solde clair en francs, sans ambiguïté.
    expect(screen.getByText('110 000 F')).toBeVisible()
    // Ouvert = badge vert (libellé « Ouvert »).
    expect(screen.getByText('Ouvert')).toBeVisible()
    expect(screen.getByRole('button', { name: /Ouvrir un compte/ })).toBeVisible()
  })

  it('membre prospect : pas de bouton, et on EXPLIQUE pourquoi (gate KYC)', async () => {
    comptesSimules.mockResolvedValue([])
    afficher('prospect')

    // Le gate est expliqué à l'écran (on attend la fin du chargement).
    expect(await screen.findByText(/doit être activé/i)).toBeVisible()
    expect(screen.queryByRole('button', { name: /Ouvrir un compte/ })).toBeNull()
  })

  it('sans la permission : ni bouton, ni note de gate', async () => {
    etat.permissions = []
    comptesSimules.mockResolvedValue([])
    afficher('prospect')

    // On attend le rendu du corps (état vide), puis on vérifie les absences.
    expect(await screen.findByText(/Aucun compte/i)).toBeVisible()
    expect(screen.queryByRole('button', { name: /Ouvrir un compte/ })).toBeNull()
    expect(screen.queryByText(/doit être activé/i)).toBeNull()
  })

  it('aucun compte : message vide', async () => {
    comptesSimules.mockResolvedValue([])
    afficher('actif')

    expect(await screen.findByText(/Aucun compte/i)).toBeVisible()
  })
})
