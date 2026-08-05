import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  creerDemandeCredit,
  listerDemandesCreditTier,
  listerProduitsCredit,
} from '@/features/credit/api'
import { OngletCredit } from '@/features/credit/OngletCredit'

/**
 * Onglet Crédit de la fiche tiers. Points durs : la création n'apparaît que pour un tiers ACTIF
 * (gate KYC EXPLIQUÉ sinon), la liste vient d'un endpoint PAR TIERS cloisonné côté serveur (pas
 * d'un filtrage client de la liste réseau), et chaque dossier mène à sa vue détail.
 */

const etat = vi.hoisted(() => ({ permissions: ['credit.demande.create'] as string[] }))

vi.mock('@/features/auth/useProfil', () => ({
  useAPermission: (p: string) => etat.permissions.includes(p),
}))

vi.mock('@/features/credit/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/credit/api')>(
    '@/features/credit/api',
  )
  return {
    ...reel,
    listerDemandesCreditTier: vi.fn(),
    listerProduitsCredit: vi.fn(),
    creerDemandeCredit: vi.fn(),
  }
})

const demandesSimulees = vi.mocked(listerDemandesCreditTier)
const produitsSimules = vi.mocked(listerProduitsCredit)
const creerSimule = vi.mocked(creerDemandeCredit)

function unDossier(o: Partial<ReturnType<typeof base>> = {}) {
  return { ...base(), ...o }
}
function base() {
  return {
    id: 'd1',
    application_number: 'CR-2026-0000001',
    tier_number: 'M-2026-0000001',
    tier_nom: 'Diallo Amadou',
    is_member: true,
    product_code: 'CRT1',
    product_name: 'Crédit court terme',
    montant_demande: 500000,
    duree_echeances: 12,
    status: 'en_instruction',
    created_at: '2026-08-04T10:00:00Z',
  }
}

function afficher(statut = 'actif') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <OngletCredit tierId="t1" tierStatut={statut} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.permissions = ['credit.demande.create']
})

describe('OngletCredit', () => {
  it('tiers actif : appelle l’endpoint PAR TIERS et liste ses dossiers', async () => {
    demandesSimulees.mockResolvedValue([unDossier()])
    afficher('actif')

    expect(await screen.findByText('CR-2026-0000001')).toBeVisible()
    expect(screen.getByText('500 000 F')).toBeVisible()
    expect(screen.getByRole('button', { name: /Nouvelle demande/ })).toBeVisible()
    expect(demandesSimulees).toHaveBeenCalledWith('t1')
  })

  it('tiers prospect : pas de bouton, et on EXPLIQUE pourquoi (gate KYC)', async () => {
    demandesSimulees.mockResolvedValue([])
    afficher('prospect')

    expect(await screen.findByText(/doit être actif/i)).toBeVisible()
    expect(screen.queryByRole('button', { name: /Nouvelle demande/ })).toBeNull()
  })

  it('sans dossier : message vide, pas une liste qui semble cassée', async () => {
    demandesSimulees.mockResolvedValue([])
    afficher('actif')

    expect(await screen.findByText('Aucune demande de crédit.')).toBeVisible()
  })

  it('crée une demande via le formulaire et rafraîchit la liste', async () => {
    demandesSimulees.mockResolvedValue([])
    produitsSimules.mockResolvedValue([
      { id: 'p1', code: 'CRT1', name: 'Crédit court terme', is_provisional: true },
    ])
    creerSimule.mockResolvedValue(unDossier())
    afficher('actif')

    fireEvent.click(await screen.findByRole('button', { name: /Nouvelle demande/ }))
    // Attendre que le produit soit chargé (l'option existe) avant de le sélectionner.
    await screen.findByRole('option', { name: /Crédit court terme/ })
    fireEvent.change(screen.getByLabelText('Produit de crédit'), { target: { value: 'p1' } })
    fireEvent.change(screen.getByLabelText('Montant demandé'), { target: { value: '500000' } })
    fireEvent.change(screen.getByLabelText('Durée (nombre d’échéances)'), {
      target: { value: '12' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Créer la demande' }))

    await waitFor(() =>
      expect(creerSimule).toHaveBeenCalledWith('t1', {
        product_id: 'p1',
        montant_demande: 500000,
        duree_echeances: 12,
        objet: undefined,
      }),
    )
  })
})
