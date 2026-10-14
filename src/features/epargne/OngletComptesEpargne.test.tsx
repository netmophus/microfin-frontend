import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  fermerCompte,
  lireCompte,
  listerComptesMembre,
  listerProduits,
  ouvrirDepotATerme,
  simulerDepotATerme,
} from '@/features/epargne/api'
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
    simulerDepotATerme: vi.fn(),
    ouvrirDepotATerme: vi.fn(),
  }
})

const comptesSimules = vi.mocked(listerComptesMembre)
const detailSimule = vi.mocked(lireCompte)
const fermerSimule = vi.mocked(fermerCompte)
const produitsSimules = vi.mocked(listerProduits)
const simulationSimulee = vi.mocked(simulerDepotATerme)
const placementSimule = vi.mocked(ouvrirDepotATerme)

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
    term_months: null as number | null,
    maturity_date: null as string | null,
    principal: null as number | null,
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

  it('refus de permission (403) : message d’accès non autorisé, distinct d’une panne', async () => {
    comptesSimules.mockRejectedValue(
      new AxiosError('rejet', undefined, undefined, undefined, { status: 403 } as never),
    )
    afficher('actif')

    expect(
      await screen.findByText(
        'Vous n’avez pas la permission de consulter les comptes d’épargne de ce membre.',
      ),
    ).toBeVisible()
    expect(screen.queryByText('Impossible de charger les comptes d’épargne.')).toBeNull()
  })

  it('panne réseau : message de chargement générique, PAS le message de permission', async () => {
    comptesSimules.mockRejectedValue(new Error('réseau'))
    afficher('actif')

    expect(await screen.findByText('Impossible de charger les comptes d’épargne.')).toBeVisible()
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
          date_comptable: '2026-01-02',
          saisi_le: '2026-07-28T10:00:00Z',
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

  it('relevé : affiche la date comptable de la pièce, la date de saisie reste en infobulle', async () => {
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
          date_comptable: '2026-01-02',
          saisi_le: '2026-10-10T10:00:00Z',
          entry_number: 'CA-2026-000001',
        },
      ]),
    )
    afficher('actif')
    fireEvent.click(await screen.findByRole('button', { name: /EP-2026-0000001/ }))

    const ligne = await screen.findByText(/02\/01\/2026/)
    expect(ligne).toBeVisible()
    expect(ligne.textContent).not.toMatch(/10\/10\/2026/)
    expect(ligne).toHaveAttribute('title', expect.stringMatching(/^Saisi le .*10\/10\/2026/))
  })

  it('relevé : une pièce sans date comptable affiche un tiret, pas la date de saisie', async () => {
    comptesSimules.mockResolvedValue([unCompte()])
    detailSimule.mockResolvedValue(
      detail([
        {
          id: 'm2',
          sens: 'credit',
          amount: 500,
          balance_after: 500,
          operation_type: 'depot',
          label: null,
          date_comptable: null,
          saisi_le: '2026-10-10T10:00:00Z',
          entry_number: null,
        },
      ]),
    )
    afficher('actif')
    fireEvent.click(await screen.findByRole('button', { name: /EP-2026-0000001/ }))

    const ligne = await screen.findByText(/Dépôt/)
    expect(ligne.textContent).toMatch(/^—/)
    expect(ligne.textContent).not.toMatch(/10\/10\/2026/)
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
  describe('dépôt à terme', () => {
    const produitDat = {
      id: 'dat',
      code: 'DAT',
      name: 'Dépôt à terme',
      type: 'terme',
      is_provisional: false,
      duree_min_mois: 3,
      duree_max_mois: 24,
    }
    const simulation = {
      journee_comptable: '2026-10-14',
      maturity_date: '2027-04-14',
      jours: 182,
      interets_a_l_echeance: 24932,
      total_a_l_echeance: 1024932,
      taux_bp: 500,
      penalite_anticipee_bp: 5000,
      duree_min_mois: 3,
      duree_max_mois: 24,
    }

    async function ouvrirFormulaireDat() {
      comptesSimules.mockResolvedValue([])
      produitsSimules.mockResolvedValue([
        { ...produitDat, type: 'a_vue', id: 'eav', name: 'Épargne à vue' },
        produitDat,
      ] as never)
      afficher('actif')
      fireEvent.click(await screen.findByRole('button', { name: /Ouvrir un compte/ }))
      await screen.findByRole('option', { name: /Dépôt à terme/ }) // les produits sont chargés
      fireEvent.change(screen.getByLabelText('Produit d’épargne'), { target: { value: 'dat' } })
    }

    it('choisir un produit à terme remplace l’ouverture ordinaire par durée et capital', async () => {
      await ouvrirFormulaireDat()

      expect(await screen.findByLabelText('Durée (mois)')).toBeVisible()
      expect(screen.getByLabelText('Capital à placer (F CFA)')).toBeVisible()
      expect(screen.getByText('Entre 3 et 24 mois.')).toBeVisible()
      expect(screen.queryByRole('button', { name: 'Ouvrir le compte' })).toBeNull()
      // Raccourcis : seulement ceux qui tiennent dans les bornes du produit.
      for (const mois of [3, 6, 12, 24]) {
        expect(screen.getByRole('button', { name: `${mois} mois` })).toBeVisible()
      }
      expect(screen.getByRole('button', { name: 'Placer le dépôt à terme' })).toBeDisabled()
    })

    it('simulation : échéance et intérêts attendus, affichés avant de valider', async () => {
      simulationSimulee.mockResolvedValue(simulation)
      await ouvrirFormulaireDat()

      fireEvent.click(await screen.findByRole('button', { name: '6 mois' }))
      fireEvent.change(screen.getByLabelText('Capital à placer (F CFA)'), {
        target: { value: '1 000 000' },
      })

      expect(await screen.findByText('14/04/2027')).toBeVisible()
      expect(screen.getByText('14/10/2026')).toBeVisible()
      expect(screen.getByText('24 932 F')).toBeVisible()
      expect(screen.getByText('1 024 932 F')).toBeVisible()
      expect(screen.getByText('50 % des intérêts courus')).toBeVisible()
      expect(simulationSimulee).toHaveBeenCalledWith({
        product_id: 'dat',
        term_months: 6,
        montant: 1000000,
      })
    })

    it('durée hors bornes : message, pas de simulation, placement impossible', async () => {
      await ouvrirFormulaireDat()

      fireEvent.change(await screen.findByLabelText('Durée (mois)'), { target: { value: '2' } })
      fireEvent.change(screen.getByLabelText('Capital à placer (F CFA)'), {
        target: { value: '1000000' },
      })

      expect(screen.getByText('Saisissez un nombre de mois entier, entre 3 et 24.')).toBeVisible()
      expect(screen.getByLabelText('Durée (mois)')).toHaveAttribute('aria-invalid', 'true')
      expect(simulationSimulee).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Placer le dépôt à terme' })).toBeDisabled()
    })

    it('capital avec décimales : même message que les autres montants', async () => {
      await ouvrirFormulaireDat()

      fireEvent.change(await screen.findByLabelText('Capital à placer (F CFA)'), {
        target: { value: '1000,50' },
      })

      expect(
        screen.getByText('Saisissez un montant en francs entiers, sans décimales'),
      ).toBeVisible()
    })

    it('placement : envoie durée et capital, confirme avec le numéro et l’échéance', async () => {
      simulationSimulee.mockResolvedValue(simulation)
      placementSimule.mockResolvedValue({
        compte: unCompte({ account_number: 'DT-2026-0000001', maturity_date: '2027-04-14' }),
        entry_number: 'CA-0001',
        interets_a_l_echeance: 24932,
      } as never)
      await ouvrirFormulaireDat()
      fireEvent.click(await screen.findByRole('button', { name: '6 mois' }))
      fireEvent.change(screen.getByLabelText('Capital à placer (F CFA)'), {
        target: { value: '1000000' },
      })
      await screen.findByText('1 024 932 F')

      fireEvent.click(screen.getByRole('button', { name: 'Placer le dépôt à terme' }))

      await waitFor(() =>
        expect(placementSimule).toHaveBeenCalledWith('t1', {
          product_id: 'dat',
          term_months: 6,
          montant: 1000000,
        }),
      )
      expect(
        await screen.findByText('Dépôt à terme placé : DT-2026-0000001, échéance le 14/04/2027.'),
      ).toBeVisible()
    })

    it('refus du serveur (pas de session de caisse) : message métier affiché tel quel', async () => {
      simulationSimulee.mockResolvedValue(simulation)
      placementSimule.mockRejectedValue(
        new AxiosError('rejet', undefined, undefined, undefined, {
          status: 422,
          data: { detail: 'Aucune session de caisse ouverte pour vous.' },
        } as never),
      )
      await ouvrirFormulaireDat()
      fireEvent.click(await screen.findByRole('button', { name: '12 mois' }))
      fireEvent.change(screen.getByLabelText('Capital à placer (F CFA)'), {
        target: { value: '500000' },
      })
      await screen.findByText('1 024 932 F')

      fireEvent.click(screen.getByRole('button', { name: 'Placer le dépôt à terme' }))

      expect(await screen.findByText('Aucune session de caisse ouverte pour vous.')).toBeVisible()
    })

    it('produit sans durées paramétrées : on le dit et le placement est impossible', async () => {
      comptesSimules.mockResolvedValue([])
      produitsSimules.mockResolvedValue([
        { ...produitDat, duree_min_mois: null, duree_max_mois: null },
      ] as never)
      afficher('actif')
      fireEvent.click(await screen.findByRole('button', { name: /Ouvrir un compte/ }))
      await screen.findByRole('option', { name: /Dépôt à terme/ })
      fireEvent.change(screen.getByLabelText('Produit d’épargne'), { target: { value: 'dat' } })

      expect(
        await screen.findByText(/durées de ce dépôt à terme ne sont pas encore paramétrées/),
      ).toBeVisible()
      expect(screen.getByRole('button', { name: 'Placer le dépôt à terme' })).toBeDisabled()
    })

    it('la liste montre l’échéance et le panneau renvoie au guichet au lieu de la fermeture', async () => {
      etat.permissions = ['epargne.account.open', 'epargne.account.close']
      comptesSimules.mockResolvedValue([
        unCompte({
          account_number: 'DT-2026-0000001',
          product_type: 'terme',
          product_name: 'Dépôt à terme',
          term_months: 6,
          maturity_date: '2027-04-14',
          principal: 1000000,
        }),
      ])
      detailSimule.mockResolvedValue(detail([]))
      afficher('actif')

      expect(await screen.findByText('Échéance le 14/04/2027')).toBeVisible()
      fireEvent.click(screen.getByText('DT-2026-0000001'))

      expect(await screen.findByText(/il se solde au guichet/)).toBeVisible()
      expect(screen.queryByRole('button', { name: 'Fermer le compte' })).toBeNull()
    })
  })
})
