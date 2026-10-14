import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  apercuDenouement,
  denouerDepotATerme,
  deposerGuichet,
  rechercherComptes,
  retirerGuichet,
  retirerParAnticipation,
  type CompteGuichet,
} from '@/features/epargne/api'
import { OngletGuichetEpargne } from '@/features/epargne/OngletGuichetEpargne'

/**
 * Onglet Épargne du guichet. Points durs : recherche EN TEMPS RÉEL (débouncée, sans bouton ni
 * Entrée — même patron que l'onglet Crédit), rien tant que le champ est vide, le NOM du
 * titulaire est proéminent et RÉPÉTÉ à la confirmation (vérification humaine), la confirmation
 * est obligatoire avant l'opération, et un refus serveur s'affiche tel quel (message métier).
 */

const etat = vi.hoisted(() => ({ permissions: [] as string[] }))

vi.mock('@/features/auth/useProfil', () => ({
  useAPermission: (p: string) => etat.permissions.includes(p),
}))

vi.mock('@/features/epargne/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/epargne/api')>(
    '@/features/epargne/api',
  )
  return {
    ...reel,
    rechercherComptes: vi.fn(),
    deposerGuichet: vi.fn(),
    retirerGuichet: vi.fn(),
    apercuDenouement: vi.fn(),
    denouerDepotATerme: vi.fn(),
    retirerParAnticipation: vi.fn(),
  }
})

const rechercheSimule = vi.mocked(rechercherComptes)
const depotSimule = vi.mocked(deposerGuichet)
const retraitSimule = vi.mocked(retirerGuichet)
const apercuSimule = vi.mocked(apercuDenouement)
const denouementSimule = vi.mocked(denouerDepotATerme)
const retraitAnticipeSimule = vi.mocked(retirerParAnticipation)

function unCompte(o: Partial<CompteGuichet> = {}): CompteGuichet {
  return {
    id: 'c1',
    account_number: 'EP-2026-0000001',
    tier_id: 't1',
    membre_nom: 'Traoré Fatoumata',
    product_name: 'Épargne à vue',
    product_type: 'a_vue',
    currency: 'XOF',
    balance: 7000,
    status: 'actif',
    is_provisional: true,
    term_months: null,
    maturity_date: null,
    principal: null,
    ...o,
  }
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <OngletGuichetEpargne />
    </QueryClientProvider>,
  )
}

async function chercherEtSelectionner(resultat = unCompte()) {
  rechercheSimule.mockResolvedValue([resultat])
  fireEvent.change(screen.getByLabelText(/Numéro de compte ou nom du titulaire/), {
    target: { value: 'EP-2026-0000001' },
  })
  fireEvent.click(await screen.findByRole('button', { name: /Traoré Fatoumata/ }))
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.permissions = []
})

describe('OngletGuichetEpargne', () => {
  it('champ vide : aucun appel serveur (rien de ciblé à montrer)', async () => {
    afficher()

    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(rechercheSimule).not.toHaveBeenCalled()
  })

  it('filtre dès la 1ère frappe, sans bouton ni Entrée', async () => {
    rechercheSimule.mockResolvedValue([unCompte()])
    afficher()

    await userEvent.setup().type(
      screen.getByLabelText(/Numéro de compte ou nom du titulaire/),
      'T',
    )

    expect(screen.queryByRole('button', { name: /^Chercher$/ })).toBeNull()
    expect(await screen.findByText('Traoré Fatoumata')).toBeVisible()
    expect(rechercheSimule).toHaveBeenCalledWith('T')
  })

  it('debounce : plusieurs frappes rapprochées ne déclenchent qu’UN appel, avec le texte final', async () => {
    rechercheSimule.mockResolvedValue([])
    afficher()

    await userEvent.setup().type(
      screen.getByLabelText(/Numéro de compte ou nom du titulaire/),
      'Traore',
    )

    await waitFor(() => expect(rechercheSimule).toHaveBeenCalledWith('Traore'))
    expect(rechercheSimule).toHaveBeenCalledTimes(1)
  })

  it('recherche sans résultat : message clair', async () => {
    rechercheSimule.mockResolvedValue([])
    afficher()
    fireEvent.change(screen.getByLabelText(/Numéro de compte ou nom du titulaire/), {
      target: { value: 'INTROUVABLE' },
    })

    expect(
      await screen.findByText(/Aucun compte ne correspond à cette recherche dans votre agence/),
    ).toBeVisible()
  })

  it('recherche : la liste montre le titulaire, le numéro et le solde', async () => {
    afficher()
    rechercheSimule.mockResolvedValue([unCompte()])
    fireEvent.change(screen.getByLabelText(/Numéro de compte ou nom du titulaire/), {
      target: { value: 'Traoré' },
    })

    expect(await screen.findByText('Traoré Fatoumata')).toBeVisible()
    expect(screen.getByText('EP-2026-0000001')).toBeVisible()
    expect(screen.getByText('7 000 F')).toBeVisible()
  })

  it('sélection : affiche le titulaire en évidence et permet une nouvelle recherche', async () => {
    afficher()
    await chercherEtSelectionner()

    expect(screen.getByText('7 000 F')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle recherche' }))

    expect(screen.getByLabelText(/Numéro de compte ou nom du titulaire/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Dépôt' })).toBeNull()
  })

  it('dépôt : confirmation qui RÉPÈTE le nom, puis succès et solde mis à jour', async () => {
    depotSimule.mockResolvedValue({
      account_number: 'EP-2026-0000001',
      nouveau_solde: 17000,
      entry_number: 'CA-2026-000123',
    })
    afficher()
    await chercherEtSelectionner()

    fireEvent.click(screen.getByRole('button', { name: 'Dépôt' }))
    fireEvent.change(screen.getByLabelText(/Montant/), { target: { value: '10000' } })
    fireEvent.click(screen.getByRole('button', { name: /Continuer/ }))

    // La confirmation répète le nom du titulaire.
    expect(await screen.findByText(/Confirmez-vous l’opération pour Traoré Fatoumata/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))

    expect(await screen.findByText(/Dépôt de 10 000 F enregistré/)).toBeVisible()
    expect(screen.getByText(/Nouveau solde : 17 000 F/)).toBeVisible()
  })

  it('premier dépôt refusé : le message serveur s’affiche tel quel', async () => {
    depotSimule.mockRejectedValue(
      new AxiosError('rejet', undefined, undefined, undefined, {
        status: 422,
        data: {
          detail: 'Premier dépôt insuffisant : ce produit exige au moins 5 000 F à l’ouverture.',
        },
      } as never),
    )
    afficher()
    await chercherEtSelectionner()

    fireEvent.click(screen.getByRole('button', { name: 'Dépôt' }))
    fireEvent.change(screen.getByLabelText(/Montant/), { target: { value: '1000' } })
    fireEvent.click(screen.getByRole('button', { name: /Continuer/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))

    expect(
      await screen.findByText(
        'Premier dépôt insuffisant : ce produit exige au moins 5 000 F à l’ouverture.',
      ),
    ).toBeVisible()
  })

  it('retrait refusé : le message serveur s’affiche tel quel', async () => {
    retraitSimule.mockRejectedValue(
      new AxiosError('rejet', undefined, undefined, undefined, {
        status: 422,
        data: { detail: 'Solde insuffisant : disponible 7 000 F' },
      } as never),
    )
    afficher()
    await chercherEtSelectionner()

    fireEvent.click(screen.getByRole('button', { name: 'Retrait' }))
    fireEvent.change(screen.getByLabelText(/Montant/), { target: { value: '10000' } })
    fireEvent.click(screen.getByRole('button', { name: /Continuer/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))

    await waitFor(() =>
      expect(screen.getByText(/Solde insuffisant : disponible 7 000 F/)).toBeVisible(),
    )
  })
})

describe('OngletGuichetEpargne — dépôt à terme', () => {
  const dat = () =>
    unCompte({
      account_number: 'DT-2026-0000001',
      product_name: 'Dépôt à terme',
      product_type: 'terme',
      balance: 1000000,
      term_months: 6,
      maturity_date: '2027-04-14',
      principal: 1000000,
    })

  const apercuAnticipe = {
    mode: 'anticipe' as const,
    jours: 42,
    capital: 1000000,
    interets_courus: 18000,
    penalite: 9000,
    interets_nets: 9000,
    total_paye: 1009000,
    message:
      'Retrait anticipé : capital 1 000 000 F + intérêts courus 18 000 F, moins la pénalité de 9 000 F = 1 009 000 F.',
  }
  const apercuEcheance = {
    mode: 'echeance' as const,
    jours: 182,
    capital: 1000000,
    interets_courus: 24932,
    penalite: 0,
    interets_nets: 24932,
    total_paye: 1024932,
    message: 'Dénouement à l’échéance : capital 1 000 000 F + intérêts 24 932 F = 1 024 932 F.',
  }

  async function ouvrirDat(apercu: typeof apercuAnticipe | typeof apercuEcheance) {
    apercuSimule.mockResolvedValue(apercu)
    afficher()
    await chercherEtSelectionner(dat())
  }

  it('bandeau d’échéance, capital placé, et ni dépôt ni retrait ordinaires', async () => {
    await ouvrirDat(apercuAnticipe)

    expect(await screen.findByText('Dépôt à terme — échéance le 14/04/2027')).toBeVisible()
    expect(screen.getByText('Capital placé : 1 000 000 F')).toBeVisible()
    expect(screen.getByText(/bloqué jusqu’à son échéance/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Dépôt' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Retrait' })).toBeNull()
  })

  it('avant l’échéance, responsable : aperçu avec pénalité, confirmation, puis retrait anticipé', async () => {
    etat.permissions = ['epargne.dat.retrait_anticipe']
    retraitAnticipeSimule.mockResolvedValue({
      ...apercuAnticipe,
      account_number: 'DT-2026-0000001',
      entry_number: 'CA-0042',
    })
    await ouvrirDat(apercuAnticipe)

    expect(await screen.findByText(/seul le retrait anticipé, avec pénalité, est possible/)).toBeVisible()
    expect(screen.getByText(apercuAnticipe.message)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Retrait anticipé' }))
    // Confirmation : le total ET le NOM du titulaire sont rappelés avant d'exécuter.
    expect(screen.getByText('Remettre 1 009 000 F en espèces à Traoré Fatoumata ?')).toBeVisible()
    expect(retraitAnticipeSimule).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le retrait anticipé' }))

    await waitFor(() => expect(retraitAnticipeSimule).toHaveBeenCalledWith('c1'))
    expect(await screen.findByText(/Pièce CA-0042/)).toBeVisible()
    expect(denouementSimule).not.toHaveBeenCalled()
  })

  it('avant l’échéance, caissier : le retrait anticipé est réservé au responsable', async () => {
    etat.permissions = []
    await ouvrirDat(apercuAnticipe)

    expect(await screen.findByText('Le retrait anticipé est réservé au responsable d’agence.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Retrait anticipé' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Dénouer à l’échéance' })).toBeNull()
  })

  it('à l’échéance, caissier : dénouement sans pénalité après confirmation', async () => {
    etat.permissions = []
    denouementSimule.mockResolvedValue({
      ...apercuEcheance,
      account_number: 'DT-2026-0000001',
      entry_number: 'CA-0043',
    })
    await ouvrirDat(apercuEcheance)

    expect(await screen.findByText('L’échéance est atteinte : le dénouement est sans pénalité.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Retrait anticipé' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Dénouer à l’échéance' }))
    expect(screen.getByText('Remettre 1 024 932 F en espèces à Traoré Fatoumata ?')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le dénouement' }))

    await waitFor(() => expect(denouementSimule).toHaveBeenCalledWith('c1'))
    expect(await screen.findByText(/Pièce CA-0043/)).toBeVisible()
    expect(retraitAnticipeSimule).not.toHaveBeenCalled()
  })

  it('refus du serveur à la confirmation : message métier tel quel, rien n’est présenté comme fait', async () => {
    etat.permissions = ['epargne.dat.retrait_anticipe']
    retraitAnticipeSimule.mockRejectedValue(
      new AxiosError('rejet', undefined, undefined, undefined, {
        status: 422,
        data: { detail: 'Aucune session de caisse ouverte pour vous.' },
      } as never),
    )
    await ouvrirDat(apercuAnticipe)

    fireEvent.click(await screen.findByRole('button', { name: 'Retrait anticipé' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le retrait anticipé' }))

    expect(await screen.findByText('Aucune session de caisse ouverte pour vous.')).toBeVisible()
    expect(screen.queryByText(/Pièce/)).toBeNull()
  })

  it('aperçu impossible : message d’erreur, aucune action proposée', async () => {
    apercuSimule.mockRejectedValue(new Error('réseau'))
    afficher()
    await chercherEtSelectionner(dat())

    expect(await screen.findByText('Impossible de calculer le solde de ce dépôt à terme.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Retrait anticipé' })).toBeNull()
  })
})
