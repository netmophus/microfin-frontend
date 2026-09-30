import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listerComptesSelecteur } from '@/features/comptabilite/api'
import {
  changerActivationProduitCredit,
  creerProduitCredit,
  lireRattachementsProduitCredit,
  listerProduitsCreditGestion,
  modifierProduitCredit,
  modifierRattachementsProduitCredit,
  type ProduitCreditDetail,
  type RattachementsProduitCredit,
} from '@/features/credit/api'
import { PageProduitsCredit } from '@/features/credit/PageProduitsCredit'

/**
 * Référentiel des produits de crédit (lot 3c) — UN SEUL écran à onglets. Points durs :
 * onglet Produit toujours visible (credit.product.read garantit la route), onglet
 * Rattachements masqué entièrement sans compta.plan.read (contrairement aux actions, qui se
 * masquent à l'intérieur) ; « Ajouter »/« Modifier » gardés credit.product.manage sur
 * l'onglet Produit, édition des comptes gardée compta.plan.manage sur l'onglet Rattachements.
 */

const etat = vi.hoisted(() => ({
  permissions: ['credit.product.manage', 'compta.plan.read', 'compta.plan.manage'] as string[],
}))

vi.mock('@/features/auth/useProfil', () => ({
  useAPermission: (p: string) => etat.permissions.includes(p),
}))

vi.mock('@/features/comptabilite/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/comptabilite/api')>(
    '@/features/comptabilite/api',
  )
  return { ...reel, listerComptesSelecteur: vi.fn() }
})

vi.mock('@/features/credit/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/credit/api')>(
    '@/features/credit/api',
  )
  return {
    ...reel,
    listerProduitsCreditGestion: vi.fn(),
    creerProduitCredit: vi.fn(),
    modifierProduitCredit: vi.fn(),
    validerProduitCredit: vi.fn(),
    changerActivationProduitCredit: vi.fn(),
    lireRattachementsProduitCredit: vi.fn(),
    modifierRattachementsProduitCredit: vi.fn(),
  }
})

const listerSimule = vi.mocked(listerProduitsCreditGestion)
const creerSimule = vi.mocked(creerProduitCredit)
vi.mocked(modifierProduitCredit)
vi.mocked(changerActivationProduitCredit)
const lireRattachementsSimule = vi.mocked(lireRattachementsProduitCredit)
const modifierRattachementsSimule = vi.mocked(modifierRattachementsProduitCredit)

function produit(partiel: Partial<ProduitCreditDetail> = {}): ProduitCreditDetail {
  return {
    id: 'p1',
    code: 'CCT',
    name: 'Crédit court terme',
    is_active: true,
    is_provisional: false,
    taux_bp: 1200,
    periodicite: 'mensuelle',
    methode_amortissement: 'echeance_constante',
    base_jours: 360,
    regle_arrondi: 'plus_proche',
    taux_usure_max_bp: null,
    ...partiel,
  }
}

function rattachements(
  partiel: Partial<RattachementsProduitCredit> = {},
): RattachementsProduitCredit {
  return {
    id: 'p1',
    code: 'CCT',
    name: 'Crédit court terme',
    compte_credit_membre: null,
    compte_credit_client: null,
    compte_produits_interets: null,
    ...partiel,
  }
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PageProduitsCredit />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.permissions = ['credit.product.manage', 'compta.plan.read', 'compta.plan.manage']
  listerSimule.mockResolvedValue([produit()])
  vi.mocked(listerComptesSelecteur).mockResolvedValue([])
})

describe('PageProduitsCredit', () => {
  it('charge et affiche la liste avec les 3 états', async () => {
    listerSimule.mockResolvedValue([
      produit({ code: 'CCT', is_active: true, is_provisional: false }),
      produit({ id: 'p2', code: 'CMT', is_active: false, is_provisional: false }),
      produit({ id: 'p3', code: 'CLT', is_active: false, is_provisional: true }),
    ])
    afficher()

    expect(await screen.findByText('CCT')).toBeVisible()
    expect(screen.getByText('Actif')).toBeVisible()
    expect(screen.getAllByText('Inactif')).toHaveLength(2)
    expect(screen.getByText('Provisoire')).toBeVisible()
  })

  it('« Ajouter un produit » absent sans credit.product.manage', async () => {
    etat.permissions = ['compta.plan.read', 'compta.plan.manage']
    afficher()
    await screen.findByText('Crédit court terme')

    expect(screen.queryByRole('button', { name: 'Ajouter un produit' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Modifier' })).toBeNull()
  })

  it('« Ajouter un produit » présent avec la permission, ouvre le formulaire', async () => {
    afficher()
    await screen.findByText('Crédit court terme')

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un produit' }))

    expect(screen.getByLabelText('Code')).toBeVisible()
    expect(screen.getByText(/sera créé PROVISOIRE/i)).toBeVisible()
  })

  it('création : envoie le taux converti en points de base, sans champ currency', async () => {
    listerSimule.mockResolvedValue([])
    creerSimule.mockResolvedValue(produit({ code: 'NEW' }))
    afficher()
    await screen.findByText(/Aucun produit de crédit/i)

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un produit' }))
    expect(screen.queryByLabelText('Devise')).toBeNull()
    // base_jours GELÉ (norme UEMOA, calcul périodique) : aucun champ de saisie, mention
    // informative seulement.
    expect(screen.queryByLabelText('Base jours')).toBeNull()
    expect(screen.getByText('Base de calcul : 360 jours (année commerciale).')).toBeVisible()

    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'NEW' } })
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Nouveau produit' } })
    fireEvent.change(screen.getByLabelText('Taux annuel (%)'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() =>
      expect(creerSimule).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'NEW', taux_bp: 1000, taux_usure_max_bp: null }),
      ),
    )
    expect(creerSimule).not.toHaveBeenCalledWith(
      expect.objectContaining({ base_jours: expect.anything() }),
    )
  })

  it('onglet Rattachements absent sans compta.plan.read', async () => {
    etat.permissions = ['credit.product.manage']
    afficher()
    await screen.findByText('Crédit court terme')

    expect(screen.queryByRole('tab', { name: 'Rattachements comptables' })).toBeNull()
  })

  it('onglet Rattachements : édition absente sans compta.plan.manage', async () => {
    etat.permissions = ['credit.product.manage', 'compta.plan.read']
    lireRattachementsSimule.mockResolvedValue(rattachements())
    afficher()
    await screen.findByText('Crédit court terme')

    fireEvent.click(screen.getByRole('tab', { name: 'Rattachements comptables' }))
    fireEvent.change(await screen.findByLabelText('Choisir un produit'), {
      target: { value: 'p1' },
    })

    expect(await screen.findAllByText('— non rattaché —')).toHaveLength(3)
    expect(screen.queryByRole('button', { name: 'Modifier' })).toBeNull()
  })

  it('onglet Rattachements : édition des 3 comptes avec compta.plan.manage', async () => {
    lireRattachementsSimule.mockResolvedValue(rattachements())
    modifierRattachementsSimule.mockResolvedValue(
      rattachements({
        compte_credit_membre: { account_number: '202211', name: 'Crédit CT (membre)' },
      }),
    )
    afficher()
    await screen.findByText('Crédit court terme')

    fireEvent.click(screen.getByRole('tab', { name: 'Rattachements comptables' }))
    fireEvent.change(await screen.findByLabelText('Choisir un produit'), {
      target: { value: 'p1' },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }))

    fireEvent.change(screen.getByLabelText('Motif (obligatoire)'), {
      target: { value: 'Rattachement initial' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() =>
      expect(modifierRattachementsSimule).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ motif: 'Rattachement initial' }),
      ),
    )
  })

  it('403 sur le référentiel : message humain', async () => {
    listerSimule.mockRejectedValue(
      new AxiosError('interdit', undefined, undefined, undefined, { status: 403 } as never),
    )
    afficher()

    expect(await screen.findByText(/n’avez pas la permission/i)).toBeVisible()
  })
})
