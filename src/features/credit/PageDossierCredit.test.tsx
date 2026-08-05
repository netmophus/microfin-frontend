import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  decaisserDemandeCredit,
  deciderDemandeCredit,
  lireApercuEcheancierCredit,
  lireDemandeCredit,
  lireEcheancierCredit,
  type DemandeCreditDetail,
} from '@/features/credit/api'
import { PageDossierCredit } from '@/features/credit/PageDossierCredit'
import { listerComptesMembre } from '@/features/epargne/api'

/**
 * Vue détail d'un dossier. Points durs (CR6a) : la décision n'apparaît QUE pour
 * credit.demande.decide, motif obligatoire dans LES DEUX sens, montant réduit possible à
 * l'approbation (jamais au-delà du demandé), un dossier déjà décidé affiche le résultat au lieu
 * du bloc d'action. Points durs (CR6b) : le décaissement n'apparaît QUE pour
 * credit.decaissement.create, la confirmation énonce montant/compte/durée/caractère définitif
 * AVANT le bouton (pas de clic aveugle), l'échéancier s'affiche une fois décaissé et reste
 * visible à la revisite (requête indépendante de la mutation), un échec serveur ne casse rien.
 * Point dur (aperçu) : dès `approuve` (AVANT tout décaissement), l'aperçu de l'échéancier est
 * visible avec son bandeau montants-définitifs/dates-recalculées, au-dessus du bouton Décaisser.
 */

const etat = vi.hoisted(() => ({ permissions: ['credit.demande.decide'] as string[] }))

vi.mock('@/features/auth/useProfil', () => ({
  useAPermission: (p: string) => etat.permissions.includes(p),
}))

vi.mock('@/features/credit/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/credit/api')>(
    '@/features/credit/api',
  )
  return {
    ...reel,
    lireDemandeCredit: vi.fn(),
    deciderDemandeCredit: vi.fn(),
    decaisserDemandeCredit: vi.fn(),
    lireEcheancierCredit: vi.fn(),
    lireApercuEcheancierCredit: vi.fn(),
  }
})

vi.mock('@/features/epargne/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/epargne/api')>(
    '@/features/epargne/api',
  )
  return { ...reel, listerComptesMembre: vi.fn() }
})

const lireSimule = vi.mocked(lireDemandeCredit)
const deciderSimule = vi.mocked(deciderDemandeCredit)
const decaisserSimule = vi.mocked(decaisserDemandeCredit)
const echeancierSimule = vi.mocked(lireEcheancierCredit)
const apercuSimule = vi.mocked(lireApercuEcheancierCredit)
const comptesSimules = vi.mocked(listerComptesMembre)
const ID = 'd1'

function unDossier(o: Partial<DemandeCreditDetail> = {}): DemandeCreditDetail {
  return {
    id: ID,
    application_number: 'CR-2026-0000001',
    tier_id: 't1',
    tier_number: 'M-2026-0000001',
    tier_nom: 'Diallo Amadou',
    is_member: true,
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
  // Défaut neutre : les tests qui ne portent pas sur l'aperçu/les comptes n'ont pas à s'en soucier.
  apercuSimule.mockResolvedValue([])
  comptesSimules.mockResolvedValue([])
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

  // --- Décaissement (CR6b) ---------------------------------------------------------------

  it('décaissement : bouton absent sans credit.decaissement.create', async () => {
    lireSimule.mockResolvedValue(unDossier({ status: 'approuve', montant_decide: 400000 }))
    afficher()

    await screen.findByText('Approuvée pour 400 000 F.')
    expect(screen.queryByRole('button', { name: 'Décaisser' })).toBeNull()
  })

  it('décaissement : la confirmation énonce montant, compte, durée et caractère définitif AVANT le bouton', async () => {
    etat.permissions = ['credit.decaissement.create']
    lireSimule.mockResolvedValue(
      unDossier({
        status: 'approuve',
        montant_decide: 400000,
        duree_echeances: 12,
        is_member: true,
      }),
    )
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Décaisser' }))
    // Rien n'est parti tant que la confirmation n'a pas été explicitement donnée.
    expect(decaisserSimule).not.toHaveBeenCalled()

    expect(
      screen.getByText('400 000 F seront décaissés depuis la caisse de l’agence.'),
    ).toBeVisible()
    expect(
      screen.getByText(
        'La créance sera enregistrée sur le compte de crédit du membre de ce tiers, et un ' +
          'échéancier de 12 échéances sera généré et figé. Cette action est définitive.',
      ),
    ).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le décaissement' }))
    await waitFor(() =>
      expect(decaisserSimule).toHaveBeenCalledWith(ID, {
        mode: 'caisse',
        compte_epargne_id: undefined,
      }),
    )
  })

  it('décaissement : dit « compte de crédit du client » si le tiers n’est pas membre', async () => {
    etat.permissions = ['credit.decaissement.create']
    lireSimule.mockResolvedValue(
      unDossier({ status: 'approuve', montant_decide: 400000, is_member: false }),
    )
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Décaisser' }))

    expect(screen.getByText(/compte de crédit du client de ce tiers/)).toBeVisible()
  })

  it('décaissement : échec serveur affiché en langage humain, rien ne bascule', async () => {
    etat.permissions = ['credit.decaissement.create']
    lireSimule.mockResolvedValue(unDossier({ status: 'approuve', montant_decide: 400000 }))
    decaisserSimule.mockRejectedValue(
      new AxiosError('rejet', undefined, undefined, undefined, {
        status: 422,
        data: { detail: 'Ce tiers n’est plus actif : le décaissement est refusé.' },
      } as never),
    )
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Décaisser' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le décaissement' }))

    expect(
      await screen.findByText('Ce tiers n’est plus actif : le décaissement est refusé.'),
    ).toBeVisible()
    // Rien n'a basculé côté écran : pas d'échéancier, toujours le panneau de décaissement.
    expect(screen.queryByText('Échéancier')).toBeNull()
    expect(screen.getByRole('button', { name: 'Confirmer le décaissement' })).toBeVisible()
  })

  // --- Décaissement multi-mode : caisse ou compte du tiers, tous produits confondus --------

  function unCompte(o: Partial<ReturnType<typeof compteBase>> = {}) {
    return { ...compteBase(), ...o }
  }
  function compteBase() {
    return {
      id: 'c1',
      account_number: 'EP-2026-0000006',
      product_code: 'EAV',
      product_name: 'Épargne à vue',
      product_type: 'a_vue',
      currency: 'XOF',
      balance: 15000,
      status: 'actif',
      is_provisional: true,
    }
  }

  it('option « crédit sur le compte » ABSENTE si le tiers n’a aucun compte ouvert', async () => {
    etat.permissions = ['credit.decaissement.create']
    comptesSimules.mockResolvedValue([])
    lireSimule.mockResolvedValue(unDossier({ status: 'approuve', montant_decide: 400000 }))
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Décaisser' }))
    await waitFor(() => expect(comptesSimules).toHaveBeenCalledWith('t1'))

    expect(screen.getByText('Espèces à la caisse')).toBeVisible()
    expect(screen.queryByText('Crédit sur le compte')).toBeNull()
  })

  it('le sélecteur liste les comptes ACTIFS, tous produits confondus HORS DAT, avec numéro/produit/solde', async () => {
    etat.permissions = ['credit.decaissement.create']
    comptesSimules.mockResolvedValue([
      unCompte({ id: 'c1', account_number: 'EP-2026-0000006', product_name: 'Épargne à vue' }),
      unCompte({
        id: 'c2', account_number: 'EPR-2026-0000003', product_name: 'Épargne programmée',
        product_type: 'programmee', balance: 100000,
      }),
      unCompte({
        id: 'c3', account_number: 'DT-2026-0000002', product_name: 'Dépôt à terme',
        product_type: 'terme', balance: 250000,
      }),
      unCompte({ id: 'c4', product_name: 'Compte fermé', status: 'cloture' }),
    ])
    lireSimule.mockResolvedValue(unDossier({ status: 'approuve', montant_decide: 400000 }))
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Décaisser' }))
    fireEvent.click(await screen.findByText('Crédit sur le compte'))

    // EAV et épargne programmée, ACTIFS, mélangés — pas figé sur un seul type.
    expect(
      screen.getByText('EP-2026-0000006 — Épargne à vue — solde actuel 15 000 F'),
    ).toBeVisible()
    expect(
      screen.getByText('EPR-2026-0000003 — Épargne programmée — solde actuel 100 000 F'),
    ).toBeVisible()
    // DETTE TEMPORAIRE : le DAT est exclu (aucun blocage jusqu'à échéance implémenté — voir
    // conformite-comptable.md). Ni le compte fermé, pour la raison déjà couverte ailleurs.
    expect(screen.queryByText(/DT-2026-0000002/)).toBeNull()
    expect(screen.queryByText(/Compte fermé/)).toBeNull()
  })

  it('un tiers dont le SEUL compte est un DAT : option « crédit sur le compte » absente', async () => {
    etat.permissions = ['credit.decaissement.create']
    comptesSimules.mockResolvedValue([
      unCompte({ id: 'c1', account_number: 'DT-2026-0000009', product_type: 'terme' }),
    ])
    lireSimule.mockResolvedValue(unDossier({ status: 'approuve', montant_decide: 400000 }))
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Décaisser' }))
    await waitFor(() => expect(comptesSimules).toHaveBeenCalledWith('t1'))

    expect(screen.getByText('Espèces à la caisse')).toBeVisible()
    expect(screen.queryByText('Crédit sur le compte')).toBeNull()
  })

  it('choisir un compte adapte le texte de confirmation et l’appel de décaissement', async () => {
    etat.permissions = ['credit.decaissement.create']
    comptesSimules.mockResolvedValue([unCompte()])
    lireSimule.mockResolvedValue(unDossier({ status: 'approuve', montant_decide: 400000 }))
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Décaisser' }))
    fireEvent.click(await screen.findByText('Crédit sur le compte'))
    fireEvent.click(
      screen.getByText('EP-2026-0000006 — Épargne à vue — solde actuel 15 000 F'),
    )

    expect(
      screen.getByText(
        '400 000 F seront crédités sur le compte ' +
          'EP-2026-0000006 — Épargne à vue — solde actuel 15 000 F.',
      ),
    ).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le décaissement' }))
    await waitFor(() =>
      expect(decaisserSimule).toHaveBeenCalledWith(ID, { mode: 'epargne', compte_epargne_id: 'c1' }),
    )
  })

  it('mode compte choisi mais AUCUN compte sélectionné : la confirmation reste bloquée', async () => {
    etat.permissions = ['credit.decaissement.create']
    comptesSimules.mockResolvedValue([unCompte()])
    lireSimule.mockResolvedValue(unDossier({ status: 'approuve', montant_decide: 400000 }))
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Décaisser' }))
    fireEvent.click(await screen.findByText('Crédit sur le compte'))

    expect(screen.getByRole('button', { name: 'Confirmer le décaissement' })).toBeDisabled()
    expect(decaisserSimule).not.toHaveBeenCalled()
  })

  it('échéancier affiché une fois décaissé, et reste visible à la revisite du dossier', async () => {
    lireSimule.mockResolvedValue(unDossier({ status: 'decaisse', montant_decide: 300000 }))
    echeancierSimule.mockResolvedValue([
      {
        numero: 1,
        due_date: '2026-09-04',
        capital: 25000,
        interets: 3000,
        total: 28000,
        capital_restant_du: 275000,
        status: 'a_echoir',
      },
      {
        numero: 2,
        due_date: '2026-10-04',
        capital: 25000,
        interets: 2750,
        total: 27750,
        capital_restant_du: 250000,
        status: 'a_echoir',
      },
    ])
    afficher()

    // « à la revisite » : ce test simule exactement ça — une page chargée fraîche (un seul
    // GET, pas de mutation dans ce test) qui trouve le dossier déjà décaissé.
    expect(await screen.findByText('Échéancier')).toBeVisible()
    expect(screen.getByText('28 000 F')).toBeVisible()
    expect(screen.getByText('275 000 F')).toBeVisible()
    expect(echeancierSimule).toHaveBeenCalledWith(ID)
    expect(screen.getByText('Décaissée : les fonds ont été versés.')).toBeVisible()
  })

  // --- Aperçu de l'échéancier (avant tout décaissement) ------------------------------------

  it('aperçu visible dès `approuve`, AVANT tout décaissement, avec son bandeau', async () => {
    apercuSimule.mockResolvedValue([
      { numero: 1, due_date: '2026-09-04', capital: 33333, interets: 4000, total: 37333, capital_restant_du: 366667 },
    ])
    lireSimule.mockResolvedValue(unDossier({ status: 'approuve', montant_decide: 400000 }))
    afficher()

    expect(await screen.findByText('Échéancier — aperçu')).toBeVisible()
    expect(apercuSimule).toHaveBeenCalledWith(ID)
    // Rien n'a été décaissé : la mutation de décaissement ne part jamais toute seule.
    expect(decaisserSimule).not.toHaveBeenCalled()
    // La table de l'aperçu montre le montant, sans colonne Statut (rien n'est suivi).
    expect(screen.getByText('37 333 F')).toBeVisible()
    expect(screen.queryByText('Statut')).toBeNull()

    // La phrase que le responsable doit pouvoir répéter au client, telle quelle.
    expect(
      screen.getByText('Aperçu de l’échéancier — à présenter au client avant décaissement.'),
    ).toBeVisible()
    const montantGras = screen.getByText('définitifs')
    expect(montantGras.tagName).toBe('STRONG')
    const datesGras = screen.getByText('recalculées')
    expect(datesGras.tagName).toBe('STRONG')
  })

  it('aperçu : erreur serveur affichée, le reste de l’écran (dont le bouton Décaisser) reste intact', async () => {
    etat.permissions = ['credit.decaissement.create']
    apercuSimule.mockRejectedValue(new Error('échec'))
    lireSimule.mockResolvedValue(unDossier({ status: 'approuve', montant_decide: 400000 }))
    afficher()

    expect(
      await screen.findByText('Impossible de calculer l’aperçu de l’échéancier.'),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Décaisser' })).toBeVisible()
  })

  it('aperçu absent tant que la demande n’est pas approuvée', async () => {
    lireSimule.mockResolvedValue(unDossier({ status: 'en_instruction' }))
    afficher()

    await screen.findByText('CR-2026-0000001')
    expect(screen.queryByText('Échéancier — aperçu')).toBeNull()
    expect(apercuSimule).not.toHaveBeenCalled()
  })

  // --- Impression de l'aperçu ---------------------------------------------------------------

  it('imprimer : le bouton déclenche l’impression du navigateur', async () => {
    const printSimule = vi.fn()
    vi.stubGlobal('print', printSimule)
    apercuSimule.mockResolvedValue([
      { numero: 1, due_date: '2026-09-04', capital: 33333, interets: 4000, total: 37333, capital_restant_du: 366667 },
    ])
    lireSimule.mockResolvedValue(unDossier({ status: 'approuve', montant_decide: 400000 }))
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Imprimer l’aperçu' }))
    expect(printSimule).toHaveBeenCalledOnce()

    vi.unstubAllGlobals()
  })

  it('impression : la ligne de signature du client et la date figurent dans le document', async () => {
    apercuSimule.mockResolvedValue([
      { numero: 1, due_date: '2026-09-04', capital: 33333, interets: 4000, total: 37333, capital_restant_du: 366667 },
    ])
    lireSimule.mockResolvedValue(unDossier({ status: 'approuve', montant_decide: 400000 }))
    afficher()

    await screen.findByText('Échéancier — aperçu')
    // Présentes dans le document (masquées à l'écran par `hidden`, révélées par `print:grid` —
    // jsdom n'évalue pas @media print, donc on vérifie la présence, pas la visibilité écran).
    expect(screen.getByText('Signature du client')).toBeInTheDocument()
    expect(screen.getAllByText('Date').length).toBeGreaterThan(0)
    expect(screen.getByText('Aperçu de l’échéancier de crédit')).toBeInTheDocument()
  })
})
