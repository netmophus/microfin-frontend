import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  listerComptesSelecteur,
  listerRattachementsProduits,
  modifierRattachementsProduit,
  type CompteSelecteur,
  type RattachementsProduit,
} from '@/features/comptabilite/api'
import { PageRattachementsEpargne } from '@/features/comptabilite/PageRattachementsEpargne'

/**
 * Rattachements épargne (Bloc 5). Points durs : le bouton « Modifier » n'apparaît qu'avec
 * compta.plan.manage, la ligne éditée propose seulement les comptes du sélecteur (déjà
 * filtrés côté serveur), et le motif est obligatoire pour enregistrer.
 */

const etat = vi.hoisted(() => ({ permissions: ['compta.plan.manage'] as string[] }))

vi.mock('@/features/auth/useProfil', () => ({
  useAPermission: (p: string) => etat.permissions.includes(p),
}))

vi.mock('@/features/comptabilite/api', async () => {
  const reel =
    await vi.importActual<typeof import('@/features/comptabilite/api')>(
      '@/features/comptabilite/api',
    )
  return {
    ...reel,
    listerRattachementsProduits: vi.fn(),
    listerComptesSelecteur: vi.fn(),
    modifierRattachementsProduit: vi.fn(),
  }
})

const listerProduitsSimule = vi.mocked(listerRattachementsProduits)
const listerComptesSimule = vi.mocked(listerComptesSelecteur)
const modifierSimule = vi.mocked(modifierRattachementsProduit)

function produit(partiel: Partial<RattachementsProduit> = {}): RattachementsProduit {
  return {
    id: 'p1',
    code: 'EAV',
    name: 'Épargne à vue',
    compte_epargne: { account_number: '3111', name: 'Épargne à vue membres' },
    compte_epargne_client: null,
    compte_charge_interet: null,
    ...partiel,
  }
}

const comptesSelecteur: CompteSelecteur[] = [
  { id: 'c1', account_number: '3111', name: 'Épargne à vue membres' },
  { id: 'c2', account_number: '3112', name: 'Épargne à vue clients' },
]

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PageRattachementsEpargne />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.permissions = ['compta.plan.manage']
  listerComptesSimule.mockResolvedValue(comptesSelecteur)
})

describe('PageRattachementsEpargne', () => {
  it('affiche le compte rattaché résolu en numéro + libellé', async () => {
    listerProduitsSimule.mockResolvedValue([produit()])
    afficher()

    expect(await screen.findByText('3111 — Épargne à vue membres')).toBeVisible()
    expect(screen.getAllByText('— non rattaché —')).toHaveLength(2)
  })

  it('base vide : un message, pas un tableau vide', async () => {
    listerProduitsSimule.mockResolvedValue([])
    afficher()

    expect(await screen.findByText(/Aucun produit d’épargne actif/i)).toBeVisible()
  })

  it('403 : message humain', async () => {
    listerProduitsSimule.mockRejectedValue(
      new AxiosError('interdit', undefined, undefined, undefined, { status: 403 } as never),
    )
    afficher()

    expect(await screen.findByText(/n’avez pas la permission/i)).toBeVisible()
  })

  it('« Modifier » absent sans compta.plan.manage', async () => {
    etat.permissions = []
    listerProduitsSimule.mockResolvedValue([produit()])
    afficher()
    await screen.findByText('Épargne à vue')

    expect(screen.queryByRole('button', { name: 'Modifier' })).toBeNull()
  })

  it('édition : enregistrer bloqué sans motif, propose seulement les comptes du sélecteur', async () => {
    listerProduitsSimule.mockResolvedValue([produit()])
    modifierSimule.mockResolvedValue(
      produit({ compte_epargne_client: { account_number: '3112', name: 'Épargne à vue clients' } }),
    )
    afficher()
    await screen.findByText('Épargne à vue')

    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    const selectClient = await screen.findByLabelText('Compte épargne (client)')
    const options = Array.from(selectClient.querySelectorAll('option')).map((o) => o.textContent)
    expect(options).toEqual(['— non rattaché —', '3111 — Épargne à vue membres', '3112 — Épargne à vue clients'])

    const enregistrer = screen.getByRole('button', { name: 'Enregistrer' })
    expect(enregistrer).toBeDisabled()

    fireEvent.change(selectClient, { target: { value: '3112' } })
    fireEvent.change(screen.getByLabelText('Motif (obligatoire)'), {
      target: { value: 'Ouverture du rattachement client' },
    })
    expect(enregistrer).not.toBeDisabled()
    fireEvent.click(enregistrer)

    await waitFor(() =>
      expect(modifierSimule).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({
          compte_epargne: '3111',
          compte_epargne_client: '3112',
          compte_charge_interet: null,
          motif: 'Ouverture du rattachement client',
        }),
      ),
    )
  })
})
