import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  cloturerExercice,
  listerExercices,
  previsualiserCloture,
  type ApercuCloture,
  type ExerciceResume,
} from '@/features/comptabilite/api'
import { PageExercices } from '@/features/comptabilite/PageExercices'

/**
 * Clôture TECHNIQUE d'exercice (chantier P1, lot b1). Points durs : « Clôturer » n'apparaît que
 * sur un exercice OUVERT ; l'aperçu (dry-run) est TOUJOURS affiché avant toute confirmation ;
 * le bouton de clôture se grise (absent) si des brouillons bloquent ; rien à clôturer affiche
 * un message dédié sans empêcher la navigation ; la confirmation est un pas SÉPARÉ, explicite.
 */

vi.mock('@/features/comptabilite/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/comptabilite/api')>(
    '@/features/comptabilite/api',
  )
  return {
    ...reel,
    listerExercices: vi.fn(),
    previsualiserCloture: vi.fn(),
    cloturerExercice: vi.fn(),
  }
})

const listerSimule = vi.mocked(listerExercices)
const apercuSimule = vi.mocked(previsualiserCloture)
const cloturerSimule = vi.mocked(cloturerExercice)

function exercice(o: Partial<ExerciceResume> = {}): ExerciceResume {
  return {
    id: 'ex1',
    code: '2099',
    label: 'Exercice de test',
    date_debut: '2099-01-01',
    date_fin: '2099-12-31',
    status: 'ouvert',
    ...o,
  }
}

function apercu(o: Partial<ApercuCloture> = {}): ApercuCloture {
  return {
    exercice: exercice(),
    resultat: 12000,
    compte_resultat: '591',
    lignes: [
      {
        account_number: '7T960',
        name: 'Compte 7T960',
        account_class: 7,
        total_debit: 0,
        total_credit: 12000,
        side: 'D',
        amount: 12000,
      },
    ],
    brouillons_bloquants: [],
    cloturable: true,
    ...o,
  }
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PageExercices />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PageExercices', () => {
  it('affiche la liste avec code, période et statut', async () => {
    listerSimule.mockResolvedValue([exercice()])
    afficher()

    expect(await screen.findByText('2099')).toBeVisible()
    expect(screen.getByText('Ouvert')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Clôturer' })).toBeVisible()
  })

  it('liste vide : message dédié', async () => {
    listerSimule.mockResolvedValue([])
    afficher()

    expect(await screen.findByText('Aucun exercice n’a encore été ouvert.')).toBeVisible()
  })

  it('erreur de chargement : message et bouton Réessayer', async () => {
    listerSimule.mockRejectedValue(new Error('boom'))
    afficher()

    expect(
      await screen.findByText('Impossible de charger les exercices. Réessayez dans un instant.'),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeVisible()
  })

  it('un exercice CLOS n’a pas de bouton Clôturer', async () => {
    listerSimule.mockResolvedValue([exercice({ status: 'clos' })])
    afficher()

    expect(await screen.findByText('Clos')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Clôturer' })).not.toBeInTheDocument()
  })

  it('clic sur Clôturer ouvre l’aperçu avec le résultat et le détail', async () => {
    listerSimule.mockResolvedValue([exercice()])
    apercuSimule.mockResolvedValue(apercu())
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Clôturer' }))

    expect(await screen.findByText('Excédent : 12 000 F')).toBeVisible()
    expect(
      screen.getByText('Porté au compte 591 (résultat en instance d’approbation), en attente d’approbation.'),
    ).toBeVisible()
    expect(screen.getByText('7T960')).toBeVisible()
  })

  it('rien à clôturer : message dédié, pas de tableau de détail', async () => {
    listerSimule.mockResolvedValue([exercice()])
    apercuSimule.mockResolvedValue(apercu({ resultat: 0, lignes: [] }))
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Clôturer' }))

    expect(
      await screen.findByText('Aucun mouvement de charges ou de produits sur cet exercice : rien à clôturer.'),
    ).toBeVisible()
  })

  it('brouillons bloquants : le bouton Clôturer de l’aperçu disparaît', async () => {
    listerSimule.mockResolvedValue([exercice()])
    apercuSimule.mockResolvedValue(
      apercu({
        cloturable: false,
        brouillons_bloquants: [
          { entry_id: 'b1', journal_code: 'OD', entry_date: '2099-03-01', description: 'Oublié' },
        ],
      }),
    )
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Clôturer' }))

    expect(
      await screen.findByText(
        '1 brouillon(s) empêchent la clôture. Validez-les ou supprimez-les avant de continuer.',
      ),
    ).toBeVisible()
    expect(screen.getByText('Oublié')).toBeVisible()
    // Un seul bouton "Clôturer" dans tout l'écran : celui, déjà consommé, de la liste n'existe
    // plus (on est sur l'aperçu) ; celui de l'aperçu est absent puisque non cloturable.
    expect(screen.queryByRole('button', { name: 'Clôturer' })).not.toBeInTheDocument()
  })

  it('confirme puis exécute la clôture, affiche le résultat final', async () => {
    listerSimule.mockResolvedValue([exercice()])
    apercuSimule.mockResolvedValue(apercu())
    cloturerSimule.mockResolvedValue({
      exercice: exercice({ status: 'clos' }),
      entry_number: 'OD-2099-000001',
      resultat: 12000,
    })
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Clôturer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Clôturer' }))

    expect(
      await screen.findByText(/Clôturer l’exercice 2099 \? Cette action est DÉFINITIVE/),
    ).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la clôture' }))

    expect(await screen.findByText('Exercice 2099 clôturé — pièce OD-2099-000001.')).toBeVisible()
  })

  it('retour à la liste depuis l’aperçu', async () => {
    listerSimule.mockResolvedValue([exercice()])
    apercuSimule.mockResolvedValue(apercu())
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Clôturer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Retour à la liste' }))

    expect(await screen.findByText('Exercices comptables')).toBeVisible()
  })
})
