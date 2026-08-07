import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  rechercherRemboursements,
  rembourserDemandeCredit,
  type DossierRemboursable,
} from '@/features/credit/api'
import { OngletGuichetCredit } from '@/features/credit/OngletGuichetCredit'

/**
 * Onglet Crédit du guichet (CR6d) — encaissement d'une échéance. Points durs : recherche EN
 * TEMPS RÉEL (débouncée, sans bouton ni Entrée — dès la 1ère frappe), rien tant que le champ est
 * vide, un dossier déjà soldé s'affiche TEL QUEL dans les résultats (pas un clic qui échouerait),
 * le montant est en LECTURE SEULE (jamais un champ de saisie — divergence assumée avec les
 * onglets Épargne/Parts), la confirmation RÉPÈTE le nom du tiers, et le message de succès dit si
 * le crédit est désormais soldé.
 */

vi.mock('@/features/credit/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/credit/api')>(
    '@/features/credit/api',
  )
  return { ...reel, rechercherRemboursements: vi.fn(), rembourserDemandeCredit: vi.fn() }
})

const rechercheSimule = vi.mocked(rechercherRemboursements)
const rembourserSimule = vi.mocked(rembourserDemandeCredit)

function unDossier(o: Partial<DossierRemboursable> = {}): DossierRemboursable {
  return {
    id: 'd1',
    application_number: 'CR-2026-0000001',
    tier_number: 'M-2026-0000001',
    tier_nom: 'Diallo Amadou',
    product_name: 'Crédit court terme',
    prochaine_echeance: {
      numero: 3,
      due_date: '2026-09-04',
      capital: 25000,
      interets: 3000,
      total: 28000,
      montant_paye: 0,
      solde_du: 28000,
    },
    ...o,
  }
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <OngletGuichetCredit />
    </QueryClientProvider>,
  )
}

async function chercherEtSelectionner(resultat = unDossier()) {
  rechercheSimule.mockResolvedValue([resultat])
  fireEvent.change(screen.getByLabelText(/Numéro de dossier, numéro ou nom du tiers/), {
    target: { value: 'CR-2026-0000001' },
  })
  fireEvent.click(await screen.findByRole('button', { name: /Diallo Amadou/ }))
}

beforeEach(() => vi.clearAllMocks())

describe('OngletGuichetCredit', () => {
  it('champ vide : aucun appel serveur (rien de ciblé à montrer)', async () => {
    afficher()

    // Laisse le temps à un éventuel debounce/appel intempestif de se déclencher.
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(rechercheSimule).not.toHaveBeenCalled()
  })

  it('filtre dès la 1ère frappe, sans bouton ni Entrée', async () => {
    rechercheSimule.mockResolvedValue([unDossier()])
    afficher()

    await userEvent.setup().type(
      screen.getByLabelText(/Numéro de dossier, numéro ou nom du tiers/),
      'D',
    )

    // Aucun bouton « Chercher » : le résultat doit apparaître de la seule frappe.
    expect(screen.queryByRole('button', { name: /Chercher/ })).toBeNull()
    expect(await screen.findByText('Diallo Amadou')).toBeVisible()
    expect(rechercheSimule).toHaveBeenCalledWith('D')
  })

  it('debounce : plusieurs frappes rapprochées ne déclenchent qu’UN appel, avec le texte final', async () => {
    rechercheSimule.mockResolvedValue([])
    afficher()

    await userEvent.setup().type(
      screen.getByLabelText(/Numéro de dossier, numéro ou nom du tiers/),
      'Diallo',
    )

    await waitFor(() => expect(rechercheSimule).toHaveBeenCalledWith('Diallo'))
    // Pas un appel par lettre (D, Di, Dia…) — un seul, après la pause de saisie.
    expect(rechercheSimule).toHaveBeenCalledTimes(1)
  })

  it('recherche sans résultat : message clair', async () => {
    rechercheSimule.mockResolvedValue([])
    afficher()
    fireEvent.change(screen.getByLabelText(/Numéro de dossier, numéro ou nom du tiers/), {
      target: { value: 'INTROUVABLE' },
    })

    expect(await screen.findByText(/Aucun crédit décaissé ne correspond/)).toBeVisible()
    expect(rechercheSimule).toHaveBeenCalledWith('INTROUVABLE')
  })

  it('dossier déjà soldé : affiché tel quel dans les résultats, PAS un bouton cliquable', async () => {
    rechercheSimule.mockResolvedValue([unDossier({ prochaine_echeance: null })])
    afficher()
    fireEvent.change(screen.getByLabelText(/Numéro de dossier, numéro ou nom du tiers/), {
      target: { value: 'Diallo' },
    })

    expect(await screen.findByText('Déjà soldé')).toBeVisible()
    expect(screen.queryByRole('button', { name: /Diallo Amadou/ })).toBeNull()
  })

  it('résultat avec échéance due : cliquable, montre le montant en LECTURE SEULE', async () => {
    afficher()
    await chercherEtSelectionner()

    expect(screen.getByText('Diallo Amadou')).toBeVisible()
    expect(screen.getByText('28 000 F')).toBeVisible()
    // Jamais un champ de saisie pour le montant — c'est le point dur de cet écran.
    expect(screen.queryByRole('textbox', { name: /montant/i })).toBeNull()
    expect(screen.queryByRole('spinbutton')).toBeNull()
  })

  it('CR5b : échéance partiellement payée — affiche le SOLDE (pas le total), le déjà-versé, et l’envoie au serveur', async () => {
    afficher()
    await chercherEtSelectionner(
      unDossier({
        prochaine_echeance: {
          numero: 3,
          due_date: '2026-09-04',
          capital: 25000,
          interets: 3000,
          total: 28000,
          montant_paye: 10000,
          solde_du: 18000,
        },
      }),
    )

    // Le solde, pas le total d'origine.
    expect(screen.getByText('18 000 F')).toBeVisible()
    expect(screen.queryByText('28 000 F')).toBeNull()
    expect(screen.getByText('Déjà versé : 10 000 F')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))
    expect(
      await screen.findByText(/Encaisser 18 000 F pour l’échéance #3 du crédit CR-2026-0000001/),
    ).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
    await waitFor(() => expect(rembourserSimule).toHaveBeenCalledWith('d1', 18000))
  })

  it('confirmation : répète le nom du tiers, énonce montant/échéance/dossier', async () => {
    afficher()
    await chercherEtSelectionner()

    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))

    expect(
      await screen.findByText(/Encaisser 28 000 F pour l’échéance #3 du crédit CR-2026-0000001/),
    ).toBeVisible()
    expect(screen.getByText('Confirmez-vous l’opération pour Diallo Amadou ?')).toBeVisible()
  })

  it('confirmer envoie le montant EXACT connu (jamais saisi) et dit le crédit désormais soldé', async () => {
    rembourserSimule.mockResolvedValue({
      numero: 3,
      due_date: '2026-09-04',
      capital: 25000,
      interets: 3000,
      montant_total: 28000,
      paid_at: '2026-09-04T10:00:00Z',
      solde_du: 0,
      echeance_soldee: true,
      echeances_restantes: 0,
    })
    afficher()
    await chercherEtSelectionner()
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmer' }))

    await waitFor(() => expect(rembourserSimule).toHaveBeenCalledWith('d1', 28000))
    expect(await screen.findByText(/Échéance #3 réglée : 28 000 F encaissés\./)).toBeVisible()
    expect(screen.getByText('Ce crédit est maintenant intégralement soldé.')).toBeVisible()
  })

  it('remboursement avec échéances restantes : le dit, pas « soldé »', async () => {
    rembourserSimule.mockResolvedValue({
      numero: 3,
      due_date: '2026-09-04',
      capital: 25000,
      interets: 3000,
      montant_total: 28000,
      paid_at: '2026-09-04T10:00:00Z',
      solde_du: 0,
      echeance_soldee: true,
      echeances_restantes: 2,
    })
    afficher()
    await chercherEtSelectionner()
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmer' }))

    expect(await screen.findByText('Il reste 2 échéance(s) à régler.')).toBeVisible()
    expect(screen.queryByText('Ce crédit est maintenant intégralement soldé.')).toBeNull()
  })

  it('refus serveur : message en langage humain affiché tel quel', async () => {
    rembourserSimule.mockRejectedValue(
      new AxiosError('rejet', undefined, undefined, undefined, {
        status: 422,
        data: { detail: 'Cette échéance est de 28000 F, vous avez saisi 0 F.' },
      } as never),
    )
    afficher()
    await chercherEtSelectionner()
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmer' }))

    expect(
      await screen.findByText('Cette échéance est de 28000 F, vous avez saisi 0 F.'),
    ).toBeVisible()
  })
})
