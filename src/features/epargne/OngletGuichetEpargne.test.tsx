import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  apercuDenouement,
  denouerDepotATerme,
  deposerGuichet,
  listerProduits,
  ouvrirDepotATerme,
  rechercherComptes,
  retirerGuichet,
  retirerParAnticipation,
  simulerDepotATerme,
  type CompteGuichet,
} from '@/features/epargne/api'
import { OngletGuichetEpargne } from '@/features/epargne/OngletGuichetEpargne'
import { ouvrirPdf, regenererDocument, telechargerDocument } from '@/features/documents/api'
import { listerTiers } from '@/features/tiers/api'

/**
 * Onglet Épargne du guichet. Points durs : recherche EN TEMPS RÉEL (débouncée, sans bouton ni
 * Entrée — même patron que l'onglet Crédit), rien tant que le champ est vide, le NOM du
 * titulaire est proéminent et RÉPÉTÉ à la confirmation (vérification humaine), la confirmation
 * est obligatoire avant l'opération, et un refus serveur s'affiche tel quel (message métier).
 */

const etat = vi.hoisted(() => ({
  permissions: [] as string[],
}))

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
    listerProduits: vi.fn(),
    ouvrirDepotATerme: vi.fn(),
    simulerDepotATerme: vi.fn(),
  }
})

vi.mock('@/features/documents/api', () => ({
  telechargerDocument: vi.fn(),
  regenererDocument: vi.fn(),
  ouvrirPdf: vi.fn(),
}))

vi.mock('@/features/tiers/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/tiers/api')>('@/features/tiers/api')
  return { ...reel, listerTiers: vi.fn() }
})

const rechercheSimule = vi.mocked(rechercherComptes)
const depotSimule = vi.mocked(deposerGuichet)
const retraitSimule = vi.mocked(retirerGuichet)
const apercuSimule = vi.mocked(apercuDenouement)
const denouementSimule = vi.mocked(denouerDepotATerme)
const retraitAnticipeSimule = vi.mocked(retirerParAnticipation)
const produitsSimules = vi.mocked(listerProduits)
const placementSimule = vi.mocked(ouvrirDepotATerme)
const simulationSimulee = vi.mocked(simulerDepotATerme)
const tiersSimules = vi.mocked(listerTiers)
const telechargerSimule = vi.mocked(telechargerDocument)
const regenererSimule = vi.mocked(regenererDocument)
const ouvrirSimule = vi.mocked(ouvrirPdf)

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
      date_comptable: '2026-10-14',
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
      date_comptable: '2026-10-14',
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
      date_comptable: '2026-10-14',
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

describe('OngletGuichetEpargne — ouverture d’un dépôt à terme', () => {
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
    maturity_date: '2027-10-14',
    jours: 365,
    interets_a_l_echeance: 50000,
    total_a_l_echeance: 1050000,
    taux_bp: 500,
    penalite_anticipee_bp: 5000,
    duree_min_mois: 3,
    duree_max_mois: 24,
  }
  const membre = (o: Record<string, unknown> = {}) => ({
    id: 't9',
    tier_number: 'M-2026-0000009',
    tier_type: 'individual',
    display_name: 'Diallo Amadou',
    status: 'actif',
    is_member: true,
    primary_agency_id: 'a1',
    ...o,
  })

  async function versLeFormulaire(o: { membre?: Record<string, unknown> } = {}) {
    etat.permissions = ['epargne.dat.open']
    produitsSimules.mockResolvedValue([
      { ...produitDat, type: 'a_vue', id: 'eav', name: 'Épargne à vue' },
      produitDat,
    ] as never)
    tiersSimules.mockResolvedValue({
      lignes: [membre(o.membre)],
      total: 1,
      page: 1,
      taille: 25,
    } as never)
    afficher()
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir un dépôt à terme' }))
    fireEvent.change(screen.getByLabelText('Numéro ou nom du membre'), {
      target: { value: 'Diallo' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Chercher' }))
    fireEvent.click(await screen.findByRole('button', { name: /Diallo Amadou/ }))
  }

  async function choisirProduit() {
    await screen.findByRole('option', { name: 'Dépôt à terme' }) // produits chargés
    fireEvent.change(screen.getByLabelText('Produit à terme'), { target: { value: 'dat' } })
  }

  it('l’action n’existe qu’avec epargne.dat.open', () => {
    etat.permissions = []
    afficher()
    expect(screen.queryByRole('button', { name: 'Ouvrir un dépôt à terme' })).toBeNull()
  })

  it('seuls les produits à terme sont proposés ; le nom du membre est en évidence', async () => {
    await versLeFormulaire()

    expect(await screen.findByText('Diallo Amadou')).toBeVisible()
    await screen.findByRole('option', { name: 'Dépôt à terme' })
    expect(screen.queryByRole('option', { name: 'Épargne à vue' })).toBeNull()
  })

  it('parcours complet : simulation, confirmation avec le nom du membre, puis placement', async () => {
    simulationSimulee.mockResolvedValue(simulation)
    placementSimule.mockResolvedValue({
      compte: unCompte({ account_number: 'DT-2026-0000007', maturity_date: '2027-10-14' }),
      entry_number: 'CA-0100',
      date_comptable: '2026-10-14',
      interets_a_l_echeance: 50000,
    } as never)
    await versLeFormulaire()
    await choisirProduit()

    fireEvent.click(await screen.findByRole('button', { name: '12 mois' }))
    fireEvent.change(screen.getByLabelText('Capital à placer (F CFA)'), {
      target: { value: '1 000 000' },
    })
    expect(await screen.findByText('14/10/2027')).toBeVisible()
    expect(screen.getByText('1 050 000 F')).toBeVisible()
    expect(simulationSimulee).toHaveBeenCalledWith({
      product_id: 'dat',
      term_months: 12,
      montant: 1000000,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))
    expect(
      screen.getByText(
        'Placer 1 000 000 F en dépôt à terme de 12 mois pour Diallo Amadou ? Échéance le 14/10/2027, 50 000 F d’intérêts à l’échéance.',
      ),
    ).toBeVisible()
    expect(placementSimule).not.toHaveBeenCalled() // rien n'est fait avant la confirmation
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le placement' }))

    await waitFor(() =>
      expect(placementSimule).toHaveBeenCalledWith('t9', {
        product_id: 'dat',
        term_months: 12,
        montant: 1000000,
      }),
    )
    expect(
      await screen.findByText('Dépôt à terme placé : DT-2026-0000007, échéance le 14/10/2027.'),
    ).toBeVisible()
  })

  it('modifier la saisie après « Continuer » annule la confirmation', async () => {
    simulationSimulee.mockResolvedValue(simulation)
    await versLeFormulaire()
    await choisirProduit()
    fireEvent.click(await screen.findByRole('button', { name: '12 mois' }))
    fireEvent.change(screen.getByLabelText('Capital à placer (F CFA)'), {
      target: { value: '1000000' },
    })
    await screen.findByText('1 050 000 F')
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))
    expect(screen.getByRole('button', { name: 'Confirmer le placement' })).toBeVisible()

    fireEvent.change(screen.getByLabelText('Capital à placer (F CFA)'), {
      target: { value: '2000000' },
    })

    expect(screen.queryByRole('button', { name: 'Confirmer le placement' })).toBeNull()
  })

  it('durée hors bornes ou capital décimal : messages, pas de simulation, Continuer grisé', async () => {
    await versLeFormulaire()
    await choisirProduit()

    fireEvent.change(await screen.findByLabelText('Durée (mois)'), { target: { value: '30' } })
    fireEvent.change(screen.getByLabelText('Capital à placer (F CFA)'), {
      target: { value: '1000,50' },
    })

    expect(screen.getByText('Saisissez un nombre de mois entier, entre 3 et 24.')).toBeVisible()
    expect(screen.getByText('Saisissez un montant en francs entiers, sans décimales')).toBeVisible()
    expect(simulationSimulee).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeDisabled()
  })

  it('membre non actif : on explique, aucun formulaire', async () => {
    await versLeFormulaire({ membre: { status: 'prospect' } })

    expect(await screen.findByText(/doit être activé \(KYC validé\)/)).toBeVisible()
    expect(screen.queryByLabelText('Produit à terme')).toBeNull()
  })

  it('refus du serveur (pas de session de caisse) : message métier tel quel', async () => {
    simulationSimulee.mockResolvedValue(simulation)
    placementSimule.mockRejectedValue(
      new AxiosError('rejet', undefined, undefined, undefined, {
        status: 422,
        data: { detail: 'Aucune session de caisse ouverte pour vous.' },
      } as never),
    )
    await versLeFormulaire()
    await choisirProduit()
    fireEvent.click(await screen.findByRole('button', { name: '12 mois' }))
    fireEvent.change(screen.getByLabelText('Capital à placer (F CFA)'), {
      target: { value: '1000000' },
    })
    await screen.findByText('1 050 000 F')
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le placement' }))

    expect(await screen.findByText('Aucune session de caisse ouverte pour vous.')).toBeVisible()
  })

  it('aucun produit à terme : message, pas de formulaire', async () => {
    etat.permissions = ['epargne.dat.open']
    produitsSimules.mockResolvedValue([
      { ...produitDat, type: 'a_vue', id: 'eav', name: 'Épargne à vue' },
    ] as never)
    tiersSimules.mockResolvedValue({ lignes: [membre()], total: 1, page: 1, taille: 25 } as never)
    afficher()
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir un dépôt à terme' }))
    fireEvent.change(screen.getByLabelText('Numéro ou nom du membre'), { target: { value: 'D' } })
    fireEvent.click(screen.getByRole('button', { name: 'Chercher' }))
    fireEvent.click(await screen.findByRole('button', { name: /Diallo Amadou/ }))

    expect(await screen.findByText('Aucun produit à terme n’est disponible.')).toBeVisible()
  })
})

const BOUTON_RECU = 'Télécharger / Imprimer le reçu'
const BOUTON_BON = 'Télécharger / Imprimer le bon'
const DOC_OK = { id: 'd1', nom: 'recu.pdf', statut: 'ok' as const }

describe('OngletGuichetEpargne — reçus de caisse (PDF du serveur)', () => {
  beforeEach(() => {
    etat.permissions = ['documents.read']
  })

  async function deposer(montant: string) {
    fireEvent.click(screen.getByRole('button', { name: 'Dépôt' }))
    fireEvent.change(screen.getByLabelText(/Montant/), { target: { value: montant } })
    fireEvent.click(screen.getByRole('button', { name: /Continuer/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmer' }))
  }

  const resultat = (o: Record<string, unknown> = {}) => ({
    account_number: 'EP-2026-0000001',
    nouveau_solde: 17000,
    entry_number: 'CA-2026-000123',
    date_comptable: '2026-10-14',
    ...o,
  })

  it('versement : pas de bouton avant le succès ; après, le PDF se récupère puis s’ouvre', async () => {
    const pdf = new Blob(['%PDF'])
    depotSimule.mockResolvedValue(resultat({ document: DOC_OK }))
    telechargerSimule.mockResolvedValue(pdf)
    afficher()
    await chercherEtSelectionner()
    expect(screen.queryByRole('button', { name: BOUTON_RECU })).toBeNull()

    await deposer('10000')
    fireEvent.click(await screen.findByRole('button', { name: BOUTON_RECU }))

    await waitFor(() => expect(ouvrirSimule).toHaveBeenCalledWith(pdf, 'recu.pdf'))
    expect(telechargerSimule).toHaveBeenCalledWith('d1')
  })

  it('retrait : le reçu PDF se télécharge aussi', async () => {
    retraitSimule.mockResolvedValue(resultat({ nouveau_solde: 4000, document: DOC_OK }))
    afficher()
    await chercherEtSelectionner()

    fireEvent.click(screen.getByRole('button', { name: 'Retrait' }))
    fireEvent.change(screen.getByLabelText(/Montant/), { target: { value: '3000' } })
    fireEvent.click(screen.getByRole('button', { name: /Continuer/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmer' }))

    expect(await screen.findByRole('button', { name: BOUTON_RECU })).toBeVisible()
  })

  it('un refus du serveur ne produit ni bouton ni message de document', async () => {
    depotSimule.mockRejectedValue(
      new AxiosError('rejet', undefined, undefined, undefined, {
        status: 422,
        data: { detail: 'Aucune session de caisse ouverte pour vous.' },
      } as never),
    )
    afficher()
    await chercherEtSelectionner()

    await deposer('10000')

    expect(await screen.findByText('Aucune session de caisse ouverte pour vous.')).toBeVisible()
    expect(screen.queryByRole('button', { name: BOUTON_RECU })).toBeNull()
    expect(screen.queryByText(/document PDF/)).toBeNull()
  })

  it('génération en échec : message, « Régénérer », puis le bouton de téléchargement', async () => {
    depotSimule.mockResolvedValue(resultat({ document: { ...DOC_OK, statut: 'echec' } }))
    regenererSimule.mockResolvedValue(DOC_OK)
    afficher()
    await chercherEtSelectionner()

    await deposer('10000')
    expect(await screen.findByText(/n’a pas pu être généré/)).toBeVisible()
    expect(screen.queryByRole('button', { name: BOUTON_RECU })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Régénérer' }))

    expect(await screen.findByRole('button', { name: BOUTON_RECU })).toBeVisible()
    expect(regenererSimule).toHaveBeenCalledWith('d1')
  })

  it('aucune référence : le dépôt reste réussi, un message le dit, aucun bouton', async () => {
    depotSimule.mockResolvedValue(resultat({ document: null }))
    afficher()
    await chercherEtSelectionner()

    await deposer('10000')

    expect(await screen.findByText(/document PDF n’est pas disponible/)).toBeVisible()
    expect(screen.queryByRole('button', { name: BOUTON_RECU })).toBeNull()
  })

  it('sans documents.read : pas de bouton PDF', async () => {
    etat.permissions = []
    depotSimule.mockResolvedValue(resultat({ document: DOC_OK }))
    afficher()
    await chercherEtSelectionner()

    await deposer('10000')

    expect(await screen.findByText(/document PDF n’est pas disponible/)).toBeVisible()
    expect(screen.queryByRole('button', { name: BOUTON_RECU })).toBeNull()
  })

  it('« Nouvelle opération » retire le reçu', async () => {
    depotSimule.mockResolvedValue(resultat({ document: DOC_OK }))
    afficher()
    await chercherEtSelectionner()
    await deposer('10000')
    await screen.findByRole('button', { name: BOUTON_RECU })

    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle opération' }))

    expect(screen.queryByRole('button', { name: BOUTON_RECU })).toBeNull()
  })
})

describe('OngletGuichetEpargne — reçus du dépôt à terme (PDF du serveur)', () => {
  beforeEach(() => {
    etat.permissions = ['documents.read', 'epargne.dat.retrait_anticipe']
  })

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

  const detail = (mode: 'echeance' | 'anticipe') => ({
    mode,
    capital: 1000000,
    interets_courus: 18000,
    penalite: mode === 'anticipe' ? 9000 : 0,
    interets_nets: mode === 'anticipe' ? 9000 : 18000,
    total_paye: mode === 'anticipe' ? 1009000 : 1018000,
    message: 'Détail du calcul.',
  })

  it('retrait anticipé : le reçu PDF se télécharge', async () => {
    apercuSimule.mockResolvedValue({ ...detail('anticipe'), jours: 42 })
    retraitAnticipeSimule.mockResolvedValue({
      ...detail('anticipe'),
      account_number: 'DT-2026-0000001',
      entry_number: 'CA-0042',
      date_comptable: '2026-10-14',
      document: DOC_OK,
    })
    afficher()
    await chercherEtSelectionner(dat())

    fireEvent.click(await screen.findByRole('button', { name: 'Retrait anticipé' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le retrait anticipé' }))

    expect(await screen.findByRole('button', { name: BOUTON_RECU })).toBeVisible()
  })

  it('retrait anticipé dont le reçu a échoué : « Régénérer »', async () => {
    apercuSimule.mockResolvedValue({ ...detail('anticipe'), jours: 42 })
    retraitAnticipeSimule.mockResolvedValue({
      ...detail('anticipe'),
      account_number: 'DT-2026-0000001',
      entry_number: 'CA-0042',
      date_comptable: '2026-10-14',
      document: { ...DOC_OK, statut: 'echec' },
    })
    afficher()
    await chercherEtSelectionner(dat())

    fireEvent.click(await screen.findByRole('button', { name: 'Retrait anticipé' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le retrait anticipé' }))

    expect(await screen.findByRole('button', { name: 'Régénérer' })).toBeVisible()
  })

  it('dénouement à l’échéance : le reçu PDF se télécharge', async () => {
    apercuSimule.mockResolvedValue({ ...detail('echeance'), jours: 182 })
    denouementSimule.mockResolvedValue({
      ...detail('echeance'),
      account_number: 'DT-2026-0000001',
      entry_number: 'CA-0043',
      date_comptable: '2027-04-14',
      document: DOC_OK,
    })
    afficher()
    await chercherEtSelectionner(dat())

    fireEvent.click(await screen.findByRole('button', { name: 'Dénouer à l’échéance' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le dénouement' }))

    expect(await screen.findByRole('button', { name: BOUTON_RECU })).toBeVisible()
  })

  async function placer(resultatPlacement: Record<string, unknown>) {
    etat.permissions = ['documents.read', 'epargne.dat.open']
    produitsSimules.mockResolvedValue([
      {
        id: 'dat',
        code: 'DAT',
        name: 'Dépôt à terme',
        type: 'terme',
        is_provisional: false,
        duree_min_mois: 3,
        duree_max_mois: 24,
      },
    ] as never)
    tiersSimules.mockResolvedValue({
      lignes: [
        {
          id: 't9',
          tier_number: 'M-2026-0000009',
          tier_type: 'individual',
          display_name: 'Diallo Amadou',
          status: 'actif',
          is_member: true,
          primary_agency_id: 'a1',
        },
      ],
      total: 1,
      page: 1,
      taille: 25,
    } as never)
    simulationSimulee.mockResolvedValue({
      journee_comptable: '2026-10-14',
      maturity_date: '2027-10-14',
      jours: 365,
      interets_a_l_echeance: 50000,
      total_a_l_echeance: 1050000,
      taux_bp: 500,
      penalite_anticipee_bp: 5000,
      duree_min_mois: 3,
      duree_max_mois: 24,
    })
    placementSimule.mockResolvedValue({
      compte: unCompte({
        account_number: 'DT-2026-0000007',
        term_months: 12,
        maturity_date: '2027-10-14',
        principal: 1000000,
        balance: 1000000,
      }),
      entry_number: 'CA-0100',
      date_comptable: '2026-10-14',
      interets_a_l_echeance: 50000,
      ...resultatPlacement,
    } as never)
    afficher()
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir un dépôt à terme' }))
    fireEvent.change(screen.getByLabelText('Numéro ou nom du membre'), { target: { value: 'D' } })
    fireEvent.click(screen.getByRole('button', { name: 'Chercher' }))
    fireEvent.click(await screen.findByRole('button', { name: /Diallo Amadou/ }))
    await screen.findByRole('option', { name: 'Dépôt à terme' })
    fireEvent.change(screen.getByLabelText('Produit à terme'), { target: { value: 'dat' } })
    fireEvent.click(await screen.findByRole('button', { name: '12 mois' }))
    fireEvent.change(screen.getByLabelText('Capital à placer (F CFA)'), {
      target: { value: '1000000' },
    })
    await screen.findByText('1 050 000 F')
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le placement' }))
  }

  it('placement : le reçu ET le bon sont deux documents PDF distincts', async () => {
    const recu = new Blob(['recu'])
    const bon = new Blob(['bon'])
    telechargerSimule.mockImplementation(async (id) => (id === 'd-recu' ? recu : bon))
    await placer({
      document: { id: 'd-recu', nom: 'recu_placement.pdf', statut: 'ok' },
      bon: { id: 'd-bon', nom: 'bon_dat.pdf', statut: 'ok' },
    })

    fireEvent.click(await screen.findByRole('button', { name: BOUTON_RECU }))
    await waitFor(() => expect(ouvrirSimule).toHaveBeenCalledWith(recu, 'recu_placement.pdf'))
    fireEvent.click(screen.getByRole('button', { name: BOUTON_BON }))
    await waitFor(() => expect(ouvrirSimule).toHaveBeenCalledWith(bon, 'bon_dat.pdf'))
    expect(telechargerSimule).toHaveBeenCalledWith('d-recu')
    expect(telechargerSimule).toHaveBeenCalledWith('d-bon')
  })

  it('placement : un bon en échec se régénère sans toucher au reçu', async () => {
    regenererSimule.mockResolvedValue({ id: 'd-bon', nom: 'bon_dat.pdf', statut: 'ok' })
    await placer({
      document: { id: 'd-recu', nom: 'recu_placement.pdf', statut: 'ok' },
      bon: { id: 'd-bon', nom: 'bon_dat.pdf', statut: 'echec' },
    })

    expect(await screen.findByRole('button', { name: BOUTON_RECU })).toBeVisible()
    expect(screen.queryByRole('button', { name: BOUTON_BON })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Régénérer' }))

    expect(await screen.findByRole('button', { name: BOUTON_BON })).toBeVisible()
    expect(regenererSimule).toHaveBeenCalledWith('d-bon')
    expect(screen.getByRole('button', { name: BOUTON_RECU })).toBeVisible()
  })
})
