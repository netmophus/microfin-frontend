import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  changerActivationProduit,
  creerProduit,
  listerProduitsGestion,
  modifierProduit,
  validerProduit,
  type ProduitEpargneDetail,
} from '@/features/epargne/api'
import { PageProduitsEpargne } from '@/features/epargne/PageProduitsEpargne'

/**
 * Référentiel des produits d'épargne (chantier gestion des produits, lot 2/3). Points durs :
 * « Ajouter »/« Modifier »/« Valider »/« Activer » n'apparaissent qu'avec
 * epargne.product.manage ; les 3 états (provisoire/actif/inactif) s'affichent ensemble ;
 * l'avertissement de validation (compte client non rattaché) sort dans un encart, pas noyé.
 */

const etat = vi.hoisted(() => ({ permissions: ['epargne.product.manage'] as string[] }))

vi.mock('@/features/auth/useProfil', () => ({
  useAPermission: (p: string) => etat.permissions.includes(p),
}))

vi.mock('@/features/epargne/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/epargne/api')>(
    '@/features/epargne/api',
  )
  return {
    ...reel,
    listerProduitsGestion: vi.fn(),
    creerProduit: vi.fn(),
    modifierProduit: vi.fn(),
    validerProduit: vi.fn(),
    changerActivationProduit: vi.fn(),
  }
})

const listerSimule = vi.mocked(listerProduitsGestion)
const creerSimule = vi.mocked(creerProduit)
const modifierSimule = vi.mocked(modifierProduit)
const validerSimule = vi.mocked(validerProduit)
const activationSimulee = vi.mocked(changerActivationProduit)

function produit(partiel: Partial<ProduitEpargneDetail> = {}): ProduitEpargneDetail {
  return {
    id: 'p1',
    code: 'EAV',
    name: 'Épargne à vue',
    type: 'a_vue',
    currency: 'XOF',
    is_active: true,
    is_provisional: false,
    taux_bp: 350,
    periodicite: 'annuelle',
    methode_calcul_solde: 'fin_periode',
    base_jours: 360,
    regle_arrondi: 'plus_proche',
    solde_minimum_remunere: 0,
    ...partiel,
  }
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PageProduitsEpargne />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.permissions = ['epargne.product.manage']
})

describe('PageProduitsEpargne', () => {
  it('charge et affiche la liste avec les 3 états', async () => {
    listerSimule.mockResolvedValue([
      produit({ code: 'EAV', is_active: true, is_provisional: false }),
      produit({ id: 'p2', code: 'DAT', is_active: false, is_provisional: false }),
      produit({ id: 'p3', code: 'EPR', is_active: false, is_provisional: true }),
    ])
    afficher()

    expect(await screen.findByText('EAV')).toBeVisible()
    expect(screen.getByText('Actif')).toBeVisible()
    expect(screen.getAllByText('Inactif')).toHaveLength(2)
    expect(screen.getByText('Provisoire')).toBeVisible()
  })

  it('base vide : un message', async () => {
    listerSimule.mockResolvedValue([])
    afficher()

    expect(await screen.findByText(/Aucun produit d’épargne/i)).toBeVisible()
  })

  it('403 : message humain', async () => {
    listerSimule.mockRejectedValue(
      new AxiosError('interdit', undefined, undefined, undefined, { status: 403 } as never),
    )
    afficher()

    expect(await screen.findByText(/n’avez pas la permission/i)).toBeVisible()
  })

  it('« Ajouter un produit » absent sans epargne.product.manage', async () => {
    etat.permissions = []
    listerSimule.mockResolvedValue([produit()])
    afficher()
    await screen.findByText('Épargne à vue')

    expect(screen.queryByRole('button', { name: 'Ajouter un produit' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Modifier' })).toBeNull()
  })

  it('« Ajouter un produit » présent avec la permission, ouvre le formulaire', async () => {
    listerSimule.mockResolvedValue([produit()])
    afficher()
    await screen.findByText('Épargne à vue')

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un produit' }))

    expect(screen.getByLabelText('Code')).toBeVisible()
    expect(screen.getByText(/sera créé PROVISOIRE/i)).toBeVisible()
    // Réglementaire SFD : jamais de champ de saisie du découvert, mention informative seulement.
    expect(screen.getByText(/Découvert : non autorisé/i)).toBeVisible()
    expect(screen.queryByLabelText(/découvert/i)).toBeNull()
  })

  it('création : bloquée sans code ni nom, puis enregistre', async () => {
    listerSimule.mockResolvedValue([])
    creerSimule.mockResolvedValue(produit({ code: 'NEW', name: 'Nouveau produit' }))
    afficher()
    await screen.findByText(/Aucun produit d’épargne/i)

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un produit' }))
    const enregistrer = screen.getByRole('button', { name: 'Enregistrer' })
    expect(enregistrer).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'NEW' } })
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Nouveau produit' } })
    expect(enregistrer).not.toBeDisabled()
    fireEvent.click(enregistrer)

    await waitFor(() =>
      expect(creerSimule).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'NEW', name: 'Nouveau produit', type: 'a_vue' }),
      ),
    )
  })

  it('ligne provisoire : mention et lien vers le rattachement comptable', async () => {
    listerSimule.mockResolvedValue([produit({ is_provisional: true })])
    afficher()

    expect(await screen.findByText(/en attente de rattachement comptable/i)).toBeVisible()
    const lien = screen.getByRole('link', { name: 'Rattacher les comptes' })
    expect(lien).toHaveAttribute('href', '/comptabilite/rattachements-epargne')
  })

  it('validation réussie avec avertissement : encart affiché, pas une ligne noyée', async () => {
    listerSimule.mockResolvedValue([produit({ is_provisional: true })])
    validerSimule.mockResolvedValue({
      ...produit({ is_provisional: false }),
      avertissements: [
        'Compte client non rattaché — toutes les opérations seront imputées sur le compte membre.',
      ],
    })
    afficher()
    await screen.findByText('Épargne à vue')

    fireEvent.click(screen.getByRole('button', { name: 'Valider' }))

    expect(await screen.findByText('Produit validé — à vérifier')).toBeVisible()
    expect(screen.getByText(/Compte client non rattaché/)).toBeVisible()
  })

  it('modification : motif obligatoire', async () => {
    listerSimule.mockResolvedValue([produit()])
    modifierSimule.mockResolvedValue(produit({ name: 'Nom modifié' }))
    afficher()
    await screen.findByText('Épargne à vue')

    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    const enregistrer = screen.getByRole('button', { name: 'Enregistrer' })
    expect(enregistrer).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Motif (obligatoire)'), {
      target: { value: 'Correction du nom' },
    })
    fireEvent.click(enregistrer)

    await waitFor(() =>
      expect(modifierSimule).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ motif: 'Correction du nom' }),
      ),
    )
  })

  it('désactivation : confirmation et motif obligatoires', async () => {
    listerSimule.mockResolvedValue([produit({ is_active: true })])
    activationSimulee.mockResolvedValue(produit({ is_active: false }))
    afficher()
    await screen.findByText('Épargne à vue')

    fireEvent.click(screen.getByRole('button', { name: 'Désactiver' }))
    expect(await screen.findByText(/Retirer ce produit du catalogue/)).toBeVisible()

    const confirmer = screen.getByRole('button', { name: 'Désactiver' })
    expect(confirmer).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Motif (obligatoire)'), {
      target: { value: 'Produit retiré du catalogue' },
    })
    fireEvent.click(confirmer)

    await waitFor(() =>
      expect(activationSimulee).toHaveBeenCalledWith('p1', false, 'Produit retiré du catalogue'),
    )
  })
})
