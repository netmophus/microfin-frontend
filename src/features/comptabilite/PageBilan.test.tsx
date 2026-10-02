import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { chargerBilan, type Bilan } from '@/features/comptabilite/api'
import { PageBilan } from '@/features/comptabilite/PageBilan'

/**
 * Bilan. Points durs : CONTRA_ACTIF vient en DÉDUCTION de l'actif (signe négatif affiché) ;
 * un déséquilibre affiche l'écart ET la note explicative (pas nécessairement une anomalie sur
 * un exercice en cours) ; les comptes non mappés sont listés, jamais masqués.
 */

vi.mock('@/features/comptabilite/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/comptabilite/api')>(
    '@/features/comptabilite/api',
  )
  return { ...reel, chargerBilan: vi.fn() }
})

const chargerBilanSimule = vi.mocked(chargerBilan)

function bilan(o: Partial<Bilan> = {}): Bilan {
  return {
    date: '2026-12-31',
    actif: [
      { poste_libelle: 'Tresorerie test', poste_ordre: 10, masse: 'ACTIF', montant: 100000 },
    ],
    passif: [
      { poste_libelle: 'Capital test', poste_ordre: 10, masse: 'PASSIF', montant: 100000 },
    ],
    total_actif_brut: 100000,
    total_contra_actif: 0,
    total_actif_net: 100000,
    total_passif: 100000,
    ecart: 0,
    equilibre: true,
    comptes_non_mappes: [],
    ...o,
  }
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PageBilan />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PageBilan', () => {
  it('équilibré : bandeau vert, postes actif/passif affichés', async () => {
    chargerBilanSimule.mockResolvedValue(bilan())
    afficher()

    expect(await screen.findByText('Le bilan s’équilibre : actif net = passif.')).toBeVisible()
    expect(screen.getByText('Tresorerie test')).toBeVisible()
    expect(screen.getByText('Capital test')).toBeVisible()
  })

  it('CONTRA_ACTIF affiché en déduction, avec le signe négatif', async () => {
    chargerBilanSimule.mockResolvedValue(
      bilan({
        actif: [
          { poste_libelle: 'Credits test', poste_ordre: 10, masse: 'ACTIF', montant: 50000 },
          {
            poste_libelle: 'Provisions test',
            poste_ordre: 20,
            masse: 'CONTRA_ACTIF',
            montant: 8000,
          },
        ],
        total_actif_brut: 50000,
        total_contra_actif: 8000,
        total_actif_net: 42000,
        total_passif: 42000,
      }),
    )
    afficher()

    expect(await screen.findByText('Credits test')).toBeVisible()
    expect(screen.getByText(/−\s*8 000 F/)).toBeVisible()
    expect(screen.getAllByText('42 000 F').length).toBe(2) // total actif net + total passif
  })

  it('déséquilibre : écart affiché avec la note explicative', async () => {
    chargerBilanSimule.mockResolvedValue(
      bilan({ total_actif_net: 105000, total_passif: 100000, ecart: 5000, equilibre: false }),
    )
    afficher()

    expect(await screen.findByText('Écart de 5 000 F entre l’actif net et le passif.')).toBeVisible()
    expect(
      screen.getByText(/peut simplement signifier que le résultat de la période/),
    ).toBeVisible()
  })

  it('comptes non mappés : signalés, jamais masqués', async () => {
    chargerBilanSimule.mockResolvedValue(
      bilan({
        comptes_non_mappes: [
          { account_number: '5T999', name: 'Compte orphelin', account_class: 5, solde: 3000 },
        ],
      }),
    )
    afficher()

    expect(await screen.findByText('Comptes non mappés')).toBeVisible()
    expect(screen.getByText('5T999')).toBeVisible()
    expect(screen.getByText('Compte orphelin')).toBeVisible()
  })

  it('aucun poste : message dédié, pas un tableau vide muet', async () => {
    chargerBilanSimule.mockResolvedValue(bilan({ actif: [], passif: [] }))
    afficher()

    expect(await screen.findByText('Aucun poste d’actif à cette date.')).toBeVisible()
    expect(screen.getByText('Aucun poste de passif à cette date.')).toBeVisible()
  })
})
