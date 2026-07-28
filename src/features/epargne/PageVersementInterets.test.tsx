import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { previsualiserInterets, verserInterets } from '@/features/epargne/api'
import { PageVersementInterets } from '@/features/epargne/PageVersementInterets'

/**
 * Écran de versement des intérêts. Points durs : la PRÉVISUALISATION obligatoire montre le total
 * ET le détail (taux visible) sans rien verser ; le versement exige une confirmation renforcée ;
 * une période déjà versée est DITE clairement (pas d'échec silencieux).
 */

vi.mock('@/features/epargne/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/epargne/api')>(
    '@/features/epargne/api',
  )
  return { ...reel, previsualiserInterets: vi.fn(), verserInterets: vi.fn() }
})

const apercuSimule = vi.mocked(previsualiserInterets)
const versementSimule = vi.mocked(verserInterets)

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PageVersementInterets />
    </QueryClientProvider>,
  )
}

function remplirEtPrevisualiser() {
  fireEvent.change(screen.getByLabelText('Période (libellé)'), { target: { value: '2026-S1' } })
  fireEvent.change(screen.getByLabelText('Du'), { target: { value: '2026-01-01' } })
  fireEvent.change(screen.getByLabelText('Au'), { target: { value: '2026-06-30' } })
  fireEvent.click(screen.getByRole('button', { name: 'Prévisualiser' }))
}

const apercuAvecComptes = {
  periode: '2026-S1',
  debut: '2026-01-01',
  fin: '2026-06-30',
  jours: 181,
  comptes_actifs: 3,
  comptes_taux_zero: 0,
  comptes_a_crediter: 3,
  total: 45000,
  deja_traites: 0,
  deja_verse_le: null,
  echantillon: [
    {
      account_number: 'EP-2026-0000001',
      produit: 'Épargne à vue',
      taux_bp: 1000,
      methode: 'fin_periode',
      base_solde: 300000,
      montant: 15000,
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PageVersementInterets', () => {
  it('prévisualise : montre le total ET le détail (taux visible), sans rien verser', async () => {
    apercuSimule.mockResolvedValue(apercuAvecComptes)
    afficher()
    remplirEtPrevisualiser()

    // Le résumé : X comptes, total Y F.
    expect(
      await screen.findByText(/3 comptes concernés, total à verser : 45 000 F/),
    ).toBeVisible()
    // Le DÉTAIL : le taux appliqué est visible (pas seulement le total).
    expect(screen.getByText('10 %')).toBeVisible()
    expect(screen.getByText('EP-2026-0000001')).toBeVisible()
    // Le barème est marqué PROVISOIRE.
    expect(screen.getByText(/Barème PROVISOIRE/)).toBeVisible()
    // Dry-run : aucun versement n'a été déclenché.
    expect(versementSimule).not.toHaveBeenCalled()
  })

  it('verser exige une confirmation renforcée, puis rend le résultat', async () => {
    apercuSimule.mockResolvedValue(apercuAvecComptes)
    versementSimule.mockResolvedValue({ traites: 3, credites: 3, ignores: 0, total: 45000 })
    afficher()
    remplirEtPrevisualiser()

    fireEvent.click(await screen.findByRole('button', { name: 'Verser les intérêts' }))
    // Confirmation renforcée : on énonce qu'on va créer de l'argent.
    expect(await screen.findByText(/Confirmer le versement des intérêts/)).toBeVisible()
    expect(screen.getByText(/Vous allez verser 45 000 F sur 3 comptes/)).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Verser les intérêts' }))
    await waitFor(() => expect(versementSimule).toHaveBeenCalledOnce())
    expect(await screen.findByText(/3 comptes crédités, pour un total de 45 000 F/)).toBeVisible()
  })

  it('période déjà versée : on le DIT clairement (pas d’échec silencieux)', async () => {
    apercuSimule.mockResolvedValue({
      ...apercuAvecComptes,
      comptes_a_crediter: 0,
      total: 0,
      deja_traites: 3,
      deja_verse_le: '2026-07-01T09:00:00Z',
      echantillon: [],
    })
    afficher()
    remplirEtPrevisualiser()

    expect(await screen.findByText(/Intérêts déjà versés pour cette période/)).toBeVisible()
    // Pas de bouton de versement quand il n'y a rien à verser.
    expect(screen.queryByRole('button', { name: 'Verser les intérêts' })).toBeNull()
  })

  it('taux à 0 : rien à verser, mais l’écran DIT la raison (pas de silence)', async () => {
    apercuSimule.mockResolvedValue({
      ...apercuAvecComptes,
      comptes_actifs: 2,
      comptes_taux_zero: 2,
      comptes_a_crediter: 0,
      total: 0,
      deja_traites: 0,
      deja_verse_le: null,
      echantillon: [],
    })
    afficher()
    remplirEtPrevisualiser()

    expect(await screen.findByText(/Aucun intérêt à verser sur cette période/)).toBeVisible()
    expect(screen.getByText(/produits d’épargne sont à taux 0/)).toBeVisible()
  })

  it('champs incomplets : le clic n’est pas silencieux, on réclame la saisie', async () => {
    afficher()
    // On clique SANS remplir : le bouton reste actif, mais explique ce qui manque.
    fireEvent.click(screen.getByRole('button', { name: 'Prévisualiser' }))

    expect(await screen.findByText(/Renseignez la période/)).toBeVisible()
    expect(apercuSimule).not.toHaveBeenCalled()
  })
})
