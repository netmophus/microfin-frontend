import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { deciderDemandeCredit, lireDemandeCredit, type DemandeCreditDetail } from '@/features/credit/api'
import { PageDossierCredit } from '@/features/credit/PageDossierCredit'

/**
 * Vue détail d'un dossier. Points durs : la décision n'apparaît QUE pour credit.demande.decide,
 * motif obligatoire dans LES DEUX sens, montant réduit possible à l'approbation (jamais au-delà
 * du demandé), et un dossier déjà décidé affiche le résultat au lieu du bloc d'action.
 */

const etat = vi.hoisted(() => ({ permissions: ['credit.demande.decide'] as string[] }))

vi.mock('@/features/auth/useProfil', () => ({
  useAPermission: (p: string) => etat.permissions.includes(p),
}))

vi.mock('@/features/credit/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/credit/api')>(
    '@/features/credit/api',
  )
  return { ...reel, lireDemandeCredit: vi.fn(), deciderDemandeCredit: vi.fn() }
})

const lireSimule = vi.mocked(lireDemandeCredit)
const deciderSimule = vi.mocked(deciderDemandeCredit)
const ID = 'd1'

function unDossier(o: Partial<DemandeCreditDetail> = {}): DemandeCreditDetail {
  return {
    id: ID,
    application_number: 'CR-2026-0000001',
    tier_number: 'M-2026-0000001',
    tier_nom: 'Diallo Amadou',
    product_code: 'CRT1',
    product_name: 'Crédit court terme',
    montant_demande: 500000,
    duree_echeances: 12,
    status: 'en_instruction',
    created_at: '2026-08-04T10:00:00Z',
    objet: null,
    montant_decide: null,
    decided_at: null,
    motif_decision: null,
    ...o,
  }
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/credit/${ID}`]}>
        <Routes>
          <Route path="/credit/:id" element={<PageDossierCredit />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.permissions = ['credit.demande.decide']
})

describe('PageDossierCredit', () => {
  it('affiche les infos du dossier', async () => {
    lireSimule.mockResolvedValue(unDossier({ objet: 'Achat de matériel' }))
    afficher()

    expect(await screen.findByText('CR-2026-0000001')).toBeVisible()
    expect(screen.getByText('Diallo Amadou · M-2026-0000001')).toBeVisible()
    expect(screen.getByText('500 000 F')).toBeVisible()
    expect(screen.getByText('12 échéances')).toBeVisible()
    expect(screen.getByText('Achat de matériel')).toBeVisible()
  })

  it('sans credit.demande.decide : pas de bloc décision', async () => {
    etat.permissions = []
    lireSimule.mockResolvedValue(unDossier())
    afficher()

    await screen.findByText('CR-2026-0000001')
    expect(screen.queryByRole('button', { name: 'Approuver' })).toBeNull()
  })

  it('refuser exige un motif d’au moins 3 caractères', async () => {
    lireSimule.mockResolvedValue(unDossier())
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Refuser' }))
    const bouton = screen.getByRole('button', { name: 'Confirmer la décision' })
    expect(bouton).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Motif'), { target: { value: 'ok' } })
    expect(bouton).toBeDisabled() // 2 caractères, encore insuffisant

    fireEvent.change(screen.getByLabelText('Motif'), {
      target: { value: 'Garanties insuffisantes' },
    })
    expect(bouton).not.toBeDisabled()
  })

  it('approuver : montant réduit accepté, motif obligatoire, envoie la décision', async () => {
    lireSimule.mockResolvedValue(unDossier())
    deciderSimule.mockResolvedValue(
      unDossier({ status: 'approuve', montant_decide: 400000, motif_decision: 'Capacité limitée' }),
    )
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Approuver' }))
    fireEvent.change(screen.getByLabelText('Montant accordé'), { target: { value: '400000' } })
    fireEvent.change(screen.getByLabelText('Motif'), { target: { value: 'Capacité limitée' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la décision' }))

    await waitFor(() =>
      expect(deciderSimule).toHaveBeenCalledWith(ID, {
        decision: 'approuve',
        montant_decide: 400000,
        motif: 'Capacité limitée',
      }),
    )
  })

  it('le montant accordé ne peut pas dépasser le montant demandé', async () => {
    lireSimule.mockResolvedValue(unDossier({ montant_demande: 500000 }))
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Approuver' }))
    fireEvent.change(screen.getByLabelText('Montant accordé'), { target: { value: '999999' } })
    fireEvent.change(screen.getByLabelText('Motif'), { target: { value: 'Motif suffisant' } })

    expect(screen.getByRole('button', { name: 'Confirmer la décision' })).toBeDisabled()
  })

  it('dossier déjà approuvé : affiche le résultat, pas le bloc d’action', async () => {
    lireSimule.mockResolvedValue(
      unDossier({
        status: 'approuve',
        montant_decide: 400000,
        motif_decision: 'Capacité limitée',
      }),
    )
    afficher()

    expect(await screen.findByText('Approuvée pour 400 000 F.')).toBeVisible()
    expect(screen.getByText('Motif : Capacité limitée')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Approuver' })).toBeNull()
  })

  it('dossier refusé : affiche le résultat', async () => {
    lireSimule.mockResolvedValue(unDossier({ status: 'refuse', motif_decision: 'Garanties insuffisantes' }))
    afficher()

    expect(await screen.findByText('Refusée.')).toBeVisible()
  })

  it('dossier introuvable (404) : message dédié', async () => {
    lireSimule.mockRejectedValue(
      new AxiosError('non trouvé', undefined, undefined, undefined, { status: 404 } as never),
    )
    afficher()

    expect(await screen.findByText('Ce dossier de crédit est introuvable.')).toBeVisible()
  })
})
