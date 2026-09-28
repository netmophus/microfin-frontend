import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  deposerGuichet,
  rechercherComptes,
  retirerGuichet,
  type CompteGuichet,
} from '@/features/epargne/api'
import { OngletGuichetEpargne } from '@/features/epargne/OngletGuichetEpargne'

/**
 * Onglet Épargne du guichet. Points durs : recherche EN TEMPS RÉEL (débouncée, sans bouton ni
 * Entrée — même patron que l'onglet Crédit), rien tant que le champ est vide, le NOM du
 * titulaire est proéminent et RÉPÉTÉ à la confirmation (vérification humaine), la confirmation
 * est obligatoire avant l'opération, et un refus serveur s'affiche tel quel (message métier).
 */

vi.mock('@/features/epargne/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/epargne/api')>(
    '@/features/epargne/api',
  )
  return {
    ...reel,
    rechercherComptes: vi.fn(),
    deposerGuichet: vi.fn(),
    retirerGuichet: vi.fn(),
  }
})

const rechercheSimule = vi.mocked(rechercherComptes)
const depotSimule = vi.mocked(deposerGuichet)
const retraitSimule = vi.mocked(retirerGuichet)

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

beforeEach(() => vi.clearAllMocks())

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
