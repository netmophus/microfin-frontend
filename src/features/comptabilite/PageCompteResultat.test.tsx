import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  chargerCompteResultat,
  listerExercices,
  type CompteResultatEtat,
  type ExerciceResume,
} from '@/features/comptabilite/api'
import { PageCompteResultat } from '@/features/comptabilite/PageCompteResultat'

/**
 * Compte de résultat. Points durs : exercice en cours -> détail par poste + mention « période,
 * en cours » ; exercice clos -> résultat seul, détail vide, mention « re-dérivé de la clôture »
 * explicite (pas de détail laissé à croire réel) ; comptes non mappés signalés.
 */

vi.mock('@/features/comptabilite/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/comptabilite/api')>(
    '@/features/comptabilite/api',
  )
  return { ...reel, chargerCompteResultat: vi.fn(), listerExercices: vi.fn() }
})

const chargerSimule = vi.mocked(chargerCompteResultat)
const listerExercicesSimule = vi.mocked(listerExercices)

function exercice(o: Partial<ExerciceResume> = {}): ExerciceResume {
  return {
    id: 'ex1',
    code: '2026',
    label: 'Exercice 2026',
    date_debut: '2026-01-01',
    date_fin: '2026-12-31',
    status: 'ouvert',
    resultat_affecte: false,
    a_nouveaux_generes: false,
    ...o,
  }
}

function resultat(o: Partial<CompteResultatEtat> = {}): CompteResultatEtat {
  return {
    exercice: exercice(),
    date_debut: '2026-01-01',
    date_fin: '2026-06-15',
    exercice_clos: false,
    charges: [{ poste_libelle: 'Charge test', poste_ordre: 10, masse: 'CHARGE', montant: 3000 }],
    produits: [
      { poste_libelle: 'Produit test', poste_ordre: 10, masse: 'PRODUIT', montant: 9000 },
    ],
    total_charges: 3000,
    total_produits: 9000,
    resultat_net: 6000,
    source_resultat: 'periode',
    comptes_non_mappes: [],
    ...o,
  }
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PageCompteResultat />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  listerExercicesSimule.mockResolvedValue([exercice()])
})

describe('PageCompteResultat', () => {
  it('exercice en cours : détail par poste, mention période', async () => {
    chargerSimule.mockResolvedValue(resultat())
    afficher()

    expect(await screen.findByText('Excédent : 6 000 F')).toBeVisible()
    expect(screen.getByText('Calculé sur la période de l’exercice, en cours.')).toBeVisible()
    expect(screen.getByText('Charge test')).toBeVisible()
    expect(screen.getByText('Produit test')).toBeVisible()
  })

  it('exercice clos : résultat seul, détail vide, mention explicite', async () => {
    chargerSimule.mockResolvedValue(
      resultat({ exercice_clos: true, charges: [], produits: [], source_resultat: 'cloture' }),
    )
    afficher()

    expect(await screen.findByText('Excédent : 6 000 F')).toBeVisible()
    expect(
      screen.getByText(
        'Résultat re-dérivé de la clôture — le détail par poste n’est plus disponible, l’exercice est clos.',
      ),
    ).toBeVisible()
    expect(screen.getByText('Aucune charge sur la période.')).toBeVisible()
    expect(screen.getByText('Aucun produit sur la période.')).toBeVisible()
  })

  it('déficit : badge rouge', async () => {
    chargerSimule.mockResolvedValue(
      resultat({ total_charges: 9000, total_produits: 3000, resultat_net: -6000 }),
    )
    afficher()

    expect(await screen.findByText('Déficit : 6 000 F')).toBeVisible()
  })

  it('comptes non mappés : signalés', async () => {
    chargerSimule.mockResolvedValue(
      resultat({
        comptes_non_mappes: [
          { account_number: '7T999', name: 'Produit orphelin', account_class: 7, solde: 500 },
        ],
      }),
    )
    afficher()

    expect(await screen.findByText('Comptes non mappés')).toBeVisible()
    expect(screen.getByText('7T999')).toBeVisible()
  })
})
