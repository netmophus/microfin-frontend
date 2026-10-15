import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  decaisserDemandeCredit,
  lireApercuDecaissementGuichet,
  rechercherDecaissements,
  type DemandeCreditDecaissee,
  type DossierDecaissable,
  type EcheanceApercuCredit,
} from '@/features/credit/api'
import { OngletGuichetDecaissement } from '@/features/credit/OngletGuichetDecaissement'

/**
 * Onglet « Décaissement » du guichet. Points durs : recherche en temps réel (rien tant que le
 * champ est vide), le montant n'est JAMAIS saisi (celui accordé par le comité), l'échéancier est
 * montré AVANT le décaissement (colonne TVA quand le produit y est soumis), la confirmation
 * répète le nom du tiers, l'envoi se fait en mode caisse, et les refus du serveur (pas de
 * session de caisse, caisse insuffisante) sont affichés tels quels, en langage humain.
 */

vi.mock('@/features/credit/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/credit/api')>('@/features/credit/api')
  return {
    ...reel,
    rechercherDecaissements: vi.fn(),
    lireApercuDecaissementGuichet: vi.fn(),
    decaisserDemandeCredit: vi.fn(),
  }
})

const rechercheSimule = vi.mocked(rechercherDecaissements)
const apercuSimule = vi.mocked(lireApercuDecaissementGuichet)
const decaisserSimule = vi.mocked(decaisserDemandeCredit)

function unDossier(o: Partial<DossierDecaissable> = {}): DossierDecaissable {
  return {
    id: 'd1',
    application_number: 'CR-2026-0000001',
    tier_number: 'M-2026-0000001',
    tier_nom: 'Diallo Amadou',
    product_name: 'Crédit court terme',
    montant_decide: 300000,
    duree_echeances: 6,
    ...o,
  }
}

const APERCU_EXONERE: EcheanceApercuCredit[] = [
  {
    numero: 1,
    due_date: '2026-11-05',
    capital: 150000,
    interets: 3000,
    tva: 0,
    total: 153000,
    capital_restant_du: 150000,
  },
  {
    numero: 2,
    due_date: '2026-12-05',
    capital: 150000,
    interets: 1500,
    tva: 0,
    total: 151500,
    capital_restant_du: 0,
  },
]

const APERCU_TVA: EcheanceApercuCredit[] = [
  {
    numero: 1,
    due_date: '2026-11-05',
    capital: 150000,
    interets: 3000,
    tva: 570,
    total: 153570,
    capital_restant_du: 150000,
  },
  {
    numero: 2,
    due_date: '2026-12-05',
    capital: 150000,
    interets: 1500,
    tva: 285,
    total: 151785,
    capital_restant_du: 0,
  },
]

function decaisse(): DemandeCreditDecaissee {
  return { nb_echeances: 6 } as DemandeCreditDecaissee
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <OngletGuichetDecaissement />
    </QueryClientProvider>,
  )
}

async function chercherEtSelectionner() {
  rechercheSimule.mockResolvedValue([unDossier()])
  fireEvent.change(screen.getByLabelText(/Numéro de dossier, numéro ou nom du tiers/), {
    target: { value: 'CR-2026-0000001' },
  })
  fireEvent.click(await screen.findByRole('button', { name: /Diallo Amadou/ }))
}

function refus422(detail: string) {
  return new AxiosError('rejet', undefined, undefined, undefined, {
    status: 422,
    data: { detail },
  } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  apercuSimule.mockResolvedValue(APERCU_EXONERE)
})

describe('OngletGuichetDecaissement', () => {
  it('champ vide : aucun appel serveur', async () => {
    afficher()

    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(rechercheSimule).not.toHaveBeenCalled()
  })

  it('recherche sans résultat : message clair', async () => {
    rechercheSimule.mockResolvedValue([])
    afficher()
    fireEvent.change(screen.getByLabelText(/Numéro de dossier, numéro ou nom du tiers/), {
      target: { value: 'INTROUVABLE' },
    })

    expect(await screen.findByText(/Aucun crédit approuvé ne correspond/)).toBeVisible()
    expect(rechercheSimule).toHaveBeenCalledWith('INTROUVABLE')
  })

  it('sélection : montant accordé en lecture seule et échéancier affiché avant de décaisser', async () => {
    afficher()
    await chercherEtSelectionner()

    expect(screen.getByText('300 000 F', { selector: 'p' })).toBeVisible()
    expect(screen.queryByRole('textbox', { name: /montant/i })).toBeNull()
    expect(screen.queryByRole('spinbutton')).toBeNull()
    expect(await screen.findByRole('columnheader', { name: 'Total' })).toBeVisible()
    expect(apercuSimule).toHaveBeenCalledWith('d1')
    expect(decaisserSimule).not.toHaveBeenCalled()
  })

  it('produit soumis à la TVA : l’échéancier porte la colonne TVA et le total TTC', async () => {
    apercuSimule.mockResolvedValue(APERCU_TVA)
    afficher()
    await chercherEtSelectionner()

    expect(await screen.findByRole('columnheader', { name: 'TVA' })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: 'Total (TTC)' })).toBeVisible()
    expect(screen.getByLabelText('TVA totale : 855 F')).toBeVisible()
  })

  it('confirmation : répète le nom du tiers, puis décaisse en mode caisse et le dit', async () => {
    decaisserSimule.mockResolvedValue(decaisse())
    afficher()
    await chercherEtSelectionner()

    fireEvent.click(screen.getByRole('button', { name: 'Décaisser' }))
    expect(
      await screen.findByText(/Remettre 300 000 F en espèces pour le crédit CR-2026-0000001/),
    ).toBeVisible()
    expect(screen.getByText('Confirmez-vous l’opération pour Diallo Amadou ?')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))

    await waitFor(() => expect(decaisserSimule).toHaveBeenCalledWith('d1', { mode: 'caisse' }))
    expect(
      await screen.findByText('Crédit CR-2026-0000001 décaissé : 300 000 F remis en espèces.'),
    ).toBeVisible()
  })

  it('aucune session de caisse ouverte : le refus du serveur est affiché tel quel', async () => {
    decaisserSimule.mockRejectedValue(
      refus422('Aucune session de caisse ouverte : ouvrez votre caisse avant de décaisser.'),
    )
    afficher()
    await chercherEtSelectionner()
    fireEvent.click(screen.getByRole('button', { name: 'Décaisser' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmer' }))

    expect(
      await screen.findByText('Aucune session de caisse ouverte : ouvrez votre caisse avant de décaisser.'),
    ).toBeVisible()
  })

  it('caisse insuffisante : le message du serveur (disponible / à décaisser) est affiché', async () => {
    const message =
      'Solde de caisse insuffisant pour ce décaissement : disponible 100 000 F, à décaisser 300 000 F. Faites alimenter votre caisse puis recommencez.'
    decaisserSimule.mockRejectedValue(refus422(message))
    afficher()
    await chercherEtSelectionner()
    fireEvent.click(screen.getByRole('button', { name: 'Décaisser' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmer' }))

    expect(await screen.findByText(message)).toBeVisible()
    // Le dossier reste à l'écran : on peut réessayer une fois la caisse alimentée.
    expect(screen.getByRole('button', { name: 'Confirmer' })).toBeEnabled()
  })
})
