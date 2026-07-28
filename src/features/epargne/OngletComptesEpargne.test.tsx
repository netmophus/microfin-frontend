import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fermerCompte, lireCompte, listerComptesMembre } from '@/features/epargne/api'
import { OngletComptesEpargne } from '@/features/epargne/OngletComptesEpargne'

/**
 * Onglet Comptes d'épargne. Points durs : l'ouverture n'apparaît que pour un membre ACTIF (gate
 * KYC EXPLIQUÉ pour un prospect), le compte se déplie en un relevé, la fermeture affiche la
 * RESTITUTION avant de confirmer, et quand plus aucun compte n'est ouvert on DIT que le membre
 * redevient désactivable (la boucle rendue lisible).
 */

const etat = vi.hoisted(() => ({ permissions: ['epargne.account.open'] as string[] }))

vi.mock('@/features/auth/useProfil', () => ({
  useAPermission: (p: string) => etat.permissions.includes(p),
}))

vi.mock('@/features/epargne/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/epargne/api')>(
    '@/features/epargne/api',
  )
  return {
    ...reel,
    listerComptesMembre: vi.fn(),
    listerProduits: vi.fn(),
    ouvrirCompte: vi.fn(),
    lireCompte: vi.fn(),
    fermerCompte: vi.fn(),
  }
})

const comptesSimules = vi.mocked(listerComptesMembre)
const detailSimule = vi.mocked(lireCompte)
const fermerSimule = vi.mocked(fermerCompte)

function unCompte(o: Partial<ReturnType<typeof base>> = {}) {
  return { ...base(), ...o }
}
function base() {
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

function detail(mouvements: unknown[] = []) {
  return { ...base(), opened_at: '2026-07-28T10:00:00Z', closed_at: null, mouvements } as never
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
    expect(screen.getByText('110 000 F')).toBeVisible()
    expect(screen.getByText('Ouvert')).toBeVisible()
    expect(screen.getByRole('button', { name: /Ouvrir un compte/ })).toBeVisible()
  })

  it('membre prospect : pas de bouton, et on EXPLIQUE pourquoi (gate KYC)', async () => {
    comptesSimules.mockResolvedValue([])
    afficher('prospect')

    expect(await screen.findByText(/doit être activé/i)).toBeVisible()
    expect(screen.queryByRole('button', { name: /Ouvrir un compte/ })).toBeNull()
  })

  it('déplie un compte et affiche le relevé', async () => {
    comptesSimules.mockResolvedValue([unCompte()])
    detailSimule.mockResolvedValue(
      detail([
        {
          id: 'm1',
          sens: 'credit',
          amount: 10000,
          balance_after: 10000,
          operation_type: 'depot',
          label: null,
          created_at: '2026-07-28T10:00:00Z',
          entry_number: 'CA-2026-000001',
        },
      ]),
    )
    afficher('actif')
    fireEvent.click(await screen.findByRole('button', { name: /EP-2026-0000001/ }))

    // Le libellé est inline dans « date · Dépôt · Pièce … » -> matcher souple.
    expect(await screen.findByText(/Dépôt/)).toBeVisible()
    expect(screen.getByText(/CA-2026-000001/)).toBeVisible()
  })

  it('responsable : la fermeture affiche la restitution avant de confirmer', async () => {
    etat.permissions = ['epargne.account.close']
    comptesSimules.mockResolvedValue([unCompte({ balance: 7000 })])
    detailSimule.mockResolvedValue(detail())
    fermerSimule.mockResolvedValue(unCompte({ status: 'cloture', balance: 0 }))
    afficher('actif')
    fireEvent.click(await screen.findByRole('button', { name: /EP-2026-0000001/ }))

    fireEvent.click(await screen.findByRole('button', { name: 'Fermer le compte' }))
    // Restitution proéminente.
    expect(await screen.findByText(/Le solde de 7 000 F sera restitué/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /Confirmer la fermeture/ }))
    await waitFor(() => expect(fermerSimule).toHaveBeenCalledWith('c1'))
  })

  it('plus aucun compte ouvert : on DIT que le membre est désactivable', async () => {
    comptesSimules.mockResolvedValue([unCompte({ status: 'cloture' })])
    afficher('actif')

    expect(await screen.findByText(/peut être désactivé/i)).toBeVisible()
  })
})
