import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  listerParametresInteretProduits,
  modifierParametresInteretProduit,
  type ParametresInteretProduit,
} from '@/features/comptabilite/api'
import { PageParametresInteretEpargne } from '@/features/comptabilite/PageParametresInteretEpargne'

/**
 * Taux d'intérêt épargne. Points durs : le bouton « Modifier » n'apparaît qu'avec
 * compta.plan.manage, le taux se saisit en % et part en points de base (arrondi), le badge
 * « provisoire » reste affiché même après modification, et le motif est obligatoire.
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
    listerParametresInteretProduits: vi.fn(),
    modifierParametresInteretProduit: vi.fn(),
  }
})

const listerSimule = vi.mocked(listerParametresInteretProduits)
const modifierSimule = vi.mocked(modifierParametresInteretProduit)

function produit(partiel: Partial<ParametresInteretProduit> = {}): ParametresInteretProduit {
  return {
    id: 'p1',
    code: 'EAV',
    name: 'Épargne à vue',
    taux_bp: 0,
    methode_calcul_solde: 'fin_periode',
    base_jours: 360,
    regle_arrondi: 'plus_proche',
    solde_minimum_remunere: 0,
    is_provisional: true,
    ...partiel,
  }
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PageParametresInteretEpargne />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.permissions = ['compta.plan.manage']
})

describe('PageParametresInteretEpargne', () => {
  it('affiche le taux converti en pourcentage et le badge provisoire', async () => {
    listerSimule.mockResolvedValue([produit({ taux_bp: 350 })])
    afficher()

    expect(await screen.findByText('3,5 %')).toBeVisible()
    expect(screen.getByText('provisoire')).toBeVisible()
  })

  it('ne propose pas de régler la périodicité (non branchée au moteur)', async () => {
    listerSimule.mockResolvedValue([produit()])
    afficher()
    await screen.findByText('Épargne à vue')

    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    expect(screen.queryByLabelText(/périodicité/i)).toBeNull()
  })

  it('base vide : un message, pas un tableau vide', async () => {
    listerSimule.mockResolvedValue([])
    afficher()

    expect(await screen.findByText(/Aucun produit d’épargne actif/i)).toBeVisible()
  })

  it('403 : message humain', async () => {
    listerSimule.mockRejectedValue(
      new AxiosError('interdit', undefined, undefined, undefined, { status: 403 } as never),
    )
    afficher()

    expect(await screen.findByText(/n’avez pas la permission/i)).toBeVisible()
  })

  it('« Modifier » absent sans compta.plan.manage', async () => {
    etat.permissions = []
    listerSimule.mockResolvedValue([produit()])
    afficher()
    await screen.findByText('Épargne à vue')

    expect(screen.queryByRole('button', { name: 'Modifier' })).toBeNull()
  })

  it('enregistrer bloqué sans motif, envoie le taux converti en points de base', async () => {
    listerSimule.mockResolvedValue([produit({ taux_bp: 0 })])
    modifierSimule.mockResolvedValue(produit({ taux_bp: 350, is_provisional: true }))
    afficher()
    await screen.findByText('Épargne à vue')

    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    const champTaux = await screen.findByLabelText('Taux annuel (%)')

    const enregistrer = screen.getByRole('button', { name: 'Enregistrer' })
    expect(enregistrer).toBeDisabled()

    fireEvent.change(champTaux, { target: { value: '3,5' } })
    fireEvent.change(screen.getByLabelText('Motif (obligatoire)'), {
      target: { value: 'Fixation du taux 2026 par le comité' },
    })
    expect(enregistrer).not.toBeDisabled()
    fireEvent.click(enregistrer)

    await waitFor(() =>
      expect(modifierSimule).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({
          taux_bp: 350,
          methode_calcul_solde: 'fin_periode',
          base_jours: 360,
          regle_arrondi: 'plus_proche',
          solde_minimum_remunere: 0,
          motif: 'Fixation du taux 2026 par le comité',
        }),
      ),
    )
  })

  it('taux hors bornes (>100 %) bloque l’enregistrement côté écran', async () => {
    listerSimule.mockResolvedValue([produit()])
    afficher()
    await screen.findByText('Épargne à vue')

    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    fireEvent.change(await screen.findByLabelText('Taux annuel (%)'), {
      target: { value: '150' },
    })
    fireEvent.change(screen.getByLabelText('Motif (obligatoire)'), {
      target: { value: 'Test de borne' },
    })

    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  })
})
