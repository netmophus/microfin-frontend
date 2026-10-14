import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  chargerParts,
  rembourserParts,
  souscrireComptant,
  souscrireParts,
  type FichePartsSociales,
} from '@/features/tiers/api'
import { OngletParts } from '@/features/tiers/OngletParts'

/**
 * Onglet Parts sociales. Points durs : le capital en francs, le barème PROVISOIRE, le cas LISIBLE
 * « client qui détient encore des parts », et le geste central « devenir membre » (souscription au
 * comptant réservée au caissier) qui rend le tiers sociétaire.
 */

const etat = vi.hoisted(() => ({ permissions: ['tiers.shares.read'] as string[] }))

vi.mock('@/features/auth/useProfil', () => ({
  useAPermission: (p: string) => etat.permissions.includes(p),
}))

vi.mock('@/features/tiers/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/tiers/api')>(
    '@/features/tiers/api',
  )
  return {
    ...reel,
    chargerParts: vi.fn(),
    souscrireComptant: vi.fn(),
    souscrireParts: vi.fn(),
    libererParts: vi.fn(),
    rembourserParts: vi.fn(),
    annulerParts: vi.fn(),
  }
})

const partsSimule = vi.mocked(chargerParts)
const comptantSimule = vi.mocked(souscrireComptant)
const rembourserSimule = vi.mocked(rembourserParts)
const engagementSimule = vi.mocked(souscrireParts)

function base(o: Partial<FichePartsSociales> = {}): FichePartsSociales {
  return {
    is_member: true,
    shares_liberees: 10,
    shares_non_liberees: 0,
    capital_libere: 50000,
    capital_non_libere: 0,
    unit_value: 5000,
    minimum_shares: 1,
    is_refundable: true,
    membership_on: 'liberation',
    is_provisional: true,
    mouvements: [],
    ...o,
  }
}

function afficher(statut = 'actif') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <OngletParts tierId="t1" tierStatut={statut} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.permissions = ['tiers.shares.read']
})

describe('OngletParts', () => {
  it('membre : capital en francs, parts libérées, barème PROVISOIRE signalé', async () => {
    partsSimule.mockResolvedValue(base())
    afficher()

    expect(await screen.findByText('50 000 F')).toBeVisible()
    expect(screen.getByText(/10 parts libérées/)).toBeVisible()
    expect(screen.getByText('Membre')).toBeVisible()
    expect(screen.getByText('provisoire')).toBeVisible()
    expect(screen.getByText('5 000 F')).toBeVisible()
  })

  it('client qui détient encore des parts : bandeau LISIBLE, pas d’ambiguïté', async () => {
    partsSimule.mockResolvedValue(
      base({ is_member: false, shares_liberees: 2, capital_libere: 10000, minimum_shares: 5 }),
    )
    afficher()

    expect(await screen.findByText('Client')).toBeVisible()
    expect(screen.getByText(/N’est plus sociétaire/)).toBeVisible()
    expect(screen.getByText(/Non désactivable tant qu/)).toBeVisible()
  })

  it('aucune part : le dit clairement', async () => {
    partsSimule.mockResolvedValue(base({ is_member: false, shares_liberees: 0, capital_libere: 0 }))
    afficher()

    expect(await screen.findByText(/ne détient aucune part sociale/)).toBeVisible()
  })

  it('historique : affiche la date comptable de la pièce, la date de saisie reste en info-bulle', async () => {
    etat.permissions = ['tiers.shares.read']
    partsSimule.mockResolvedValue(
      base({
        mouvements: [
          {
            type: 'souscription_comptant',
            shares_count: 10,
            unit_value: 5000,
            amount: 50000,
            entry_number: 'CA-2026-000001',
            date_comptable: '2026-01-02',
            saisi_le: '2026-10-10T08:30:00Z',
          },
        ],
      }),
    )
    afficher()

    const ligne = await screen.findByText(/02\/01\/2026/)
    expect(ligne).toBeVisible()
    expect(screen.queryByText(/10\/10\/2026/)).toBeNull() // la date civile n'est pas la date affichée
    expect(ligne).toHaveAttribute('title', expect.stringContaining('10/10/2026'))
  })

  it('caissier : souscription au comptant → le tiers devient MEMBRE', async () => {
    etat.permissions = ['tiers.shares.read', 'tiers.shares.pay']
    // Au départ : client sans parts.
    partsSimule.mockResolvedValue(base({ is_member: false, shares_liberees: 0, capital_libere: 0 }))
    comptantSimule.mockResolvedValue({
      is_member: true,
      shares_liberees: 10,
      shares_non_liberees: 0,
      entry_number: 'OD-2026-000001',
      date_comptable: '2026-10-14',
    })
    afficher('actif')

    fireEvent.click(await screen.findByRole('button', { name: /Souscrire au comptant/ }))
    fireEvent.change(screen.getByLabelText('Nombre de parts'), { target: { value: '10' } })
    // Le total à encaisser est calculé et affiché.
    expect(screen.getByText(/10 parts × 5 000 F = 50 000 F à encaisser/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))
    // Confirmation qui répète l'effet (devenir membre).
    expect(screen.getByText(/rendre ce tiers MEMBRE/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))

    await waitFor(() => expect(comptantSimule).toHaveBeenCalledWith('t1', 10))
    expect(await screen.findByText(/désormais MEMBRE/)).toBeVisible()
  })

  it('gate : tiers non actif → l’action est expliquée, pas offerte', async () => {
    etat.permissions = ['tiers.shares.read', 'tiers.shares.pay']
    partsSimule.mockResolvedValue(base({ is_member: false, shares_liberees: 0, capital_libere: 0 }))
    afficher('prospect')

    expect(await screen.findByText(/doit être actif/)).toBeVisible()
    expect(screen.queryByRole('button', { name: /Souscrire au comptant/ })).toBeNull()
  })

  it('responsable : remboursement total → capital restitué affiché, redevient CLIENT', async () => {
    etat.permissions = ['tiers.shares.read', 'tiers.shares.refund']
    partsSimule.mockResolvedValue(base({ is_member: true, shares_liberees: 10, capital_libere: 50000 }))
    rembourserSimule.mockResolvedValue({
      is_member: false,
      shares_liberees: 0,
      shares_non_liberees: 0,
      entry_number: 'CA-2026-000009',
      date_comptable: '2026-10-14',
    })
    afficher('actif')

    fireEvent.click(await screen.findByRole('button', { name: /Rembourser des parts/ }))
    fireEvent.change(screen.getByLabelText('Nombre de parts'), { target: { value: '10' } })
    // Montant restitué AFFICHÉ avant de confirmer (on ne rembourse pas à l'aveugle).
    expect(screen.getByText(/50 000 F seront restitués/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))
    // Confirmation : le remboursement TOTAL prévient qu'il redevient client.
    expect(screen.getByText(/récupère tout son capital/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))

    await waitFor(() => expect(rembourserSimule).toHaveBeenCalledWith('t1', 10))
    expect(await screen.findByText(/a quitté le sociétariat/)).toBeVisible()
  })

  it('remboursement : le reçu PDF archivé se télécharge (décaissement d’espèces)', async () => {
    etat.permissions = ['tiers.shares.read', 'tiers.shares.refund', 'documents.read']
    partsSimule.mockResolvedValue(base())
    rembourserSimule.mockResolvedValue({
      is_member: false,
      shares_liberees: 0,
      shares_non_liberees: 0,
      entry_number: 'CA-2026-000009',
      date_comptable: '2026-10-14',
      document: { id: 'd1', nom: 'recu_parts_remboursement.pdf', statut: 'ok' },
    })
    afficher('actif')

    fireEvent.click(await screen.findByRole('button', { name: /Rembourser des parts/ }))
    fireEvent.change(screen.getByLabelText('Nombre de parts'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))

    expect(
      await screen.findByRole('button', { name: 'Télécharger / Imprimer le reçu' }),
    ).toBeVisible()
  })

  it('remboursement dont le reçu a échoué : message et « Régénérer »', async () => {
    etat.permissions = ['tiers.shares.read', 'tiers.shares.refund', 'documents.read']
    partsSimule.mockResolvedValue(base())
    rembourserSimule.mockResolvedValue({
      is_member: false,
      shares_liberees: 0,
      shares_non_liberees: 0,
      entry_number: 'CA-2026-000009',
      date_comptable: '2026-10-14',
      document: { id: 'd1', nom: 'recu_parts_remboursement.pdf', statut: 'echec' },
    })
    afficher('actif')

    fireEvent.click(await screen.findByRole('button', { name: /Rembourser des parts/ }))
    fireEvent.change(screen.getByLabelText('Nombre de parts'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))

    expect(await screen.findByRole('button', { name: 'Régénérer' })).toBeVisible()
  })

  it('souscription sans paiement : aucun reçu attendu, aucun message de document absent', async () => {
    etat.permissions = ['tiers.shares.read', 'tiers.shares.subscribe', 'documents.read']
    partsSimule.mockResolvedValue(base({ is_member: false, shares_liberees: 0, capital_libere: 0 }))
    engagementSimule.mockResolvedValue({
      is_member: false,
      shares_liberees: 0,
      shares_non_liberees: 3,
      entry_number: 'OD-2026-000002',
      date_comptable: '2026-10-14',
      document: null,
    })
    afficher('actif')

    fireEvent.click(await screen.findByRole('button', { name: /Souscrire/ }))
    fireEvent.change(screen.getByLabelText('Nombre de parts'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))

    await waitFor(() => expect(engagementSimule).toHaveBeenCalledWith('t1', 3))
    expect(await screen.findByRole('button', { name: 'Nouvelle opération' })).toBeVisible()
    expect(screen.queryByText(/PDF/)).toBeNull()
    expect(screen.queryByRole('button', { name: /Télécharger/ })).toBeNull()
  })

  it('le chargé ne voit PAS le bouton Rembourser (réservé responsable)', async () => {
    etat.permissions = ['tiers.shares.read', 'tiers.shares.subscribe']
    partsSimule.mockResolvedValue(base({ is_member: true, shares_liberees: 10, capital_libere: 50000 }))
    afficher('actif')

    expect(await screen.findByText('50 000 F')).toBeVisible()
    expect(screen.queryByRole('button', { name: /Rembourser/ })).toBeNull()
  })
})
