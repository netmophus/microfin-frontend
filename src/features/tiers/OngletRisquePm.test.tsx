import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { OngletRisquePm } from '@/features/tiers/OngletRisquePm'
import { listerPersonnesLiees, type LienPersonne, type PersonnesLiees } from '@/features/tiers/personnesLiees'

/**
 * Onglet « KYC / Risque » d'une société ou d'un groupement : le niveau est hérité des personnes
 * liées ; l'écran dit D'OÙ il vient (phrase du serveur) et montre l'état de chaque personne.
 */

vi.mock('@/features/tiers/personnesLiees', async () => {
  const reel = await vi.importActual<typeof import('@/features/tiers/personnesLiees')>(
    '@/features/tiers/personnesLiees',
  )
  return { ...reel, listerPersonnesLiees: vi.fn() }
})

const listerSimule = vi.mocked(listerPersonnesLiees)
const PM = '44444444-4444-4444-4444-444444444444'

function lien(over: Partial<LienPersonne>): LienPersonne {
  return {
    id: 'l1',
    individual_tier_id: 'p1',
    nom: 'BOUBACAR Idrissa',
    tier_number: 'M-2026-0000001',
    statut: 'actif',
    niveau_risque: 'eleve',
    role: 'representant_legal',
    fonction: null,
    pourcentage_detention: null,
    pouvoir_signature: false,
    date_debut: '2024-01-15',
    date_fin: null,
    en_cours: true,
    atteint_le_seuil: false,
    ...over,
  }
}

function vue(items: LienPersonne[], risque: PersonnesLiees['risque']): PersonnesLiees {
  return {
    items,
    journee_reference: '2026-10-12',
    total_beneficiaires: '0',
    seuil: '25.00',
    seuil_provisoire: true,
    risque,
  }
}

const ELEVE = {
  niveau: 'eleve',
  explication: 'Élevé — hérité de BOUBACAR Idrissa, représentant légal',
  origine: { nom: 'BOUBACAR Idrissa', numero: 'M-2026-0000001', role: 'representant_legal', niveau: 'eleve' },
  provisoire: true,
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <OngletRisquePm tierId={PM} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('OngletRisquePm', () => {
  it('affiche le niveau et son origine en clair', async () => {
    listerSimule.mockResolvedValue(vue([lien({})], ELEVE))

    afficher()

    expect(await screen.findByText('Élevé — hérité de BOUBACAR Idrissa, représentant légal')).toBeVisible()
    expect(screen.getByText(/Niveau de risque/)).toBeVisible()
  })

  it('avertit que la règle de risque des sociétés est provisoire', async () => {
    listerSimule.mockResolvedValue(vue([lien({})], ELEVE))

    afficher()

    expect(await screen.findByText(/Règle provisoire/)).toBeVisible()
  })

  it('montre l’état et le niveau de chaque personne liée en cours', async () => {
    listerSimule.mockResolvedValue(
      vue(
        [
          lien({}),
          lien({
            id: 'l2',
            individual_tier_id: 'p2',
            nom: 'TRAORE Awa',
            role: 'membre_bureau',
            statut: 'prospect',
            niveau_risque: 'faible',
          }),
          lien({ id: 'l3', nom: 'ANCIEN Paul', en_cours: false }),
        ],
        ELEVE,
      ),
    )

    afficher()
    const ligne = (await screen.findByRole('link', { name: 'TRAORE Awa' })).closest('tr')!

    expect(within(ligne).getByText('Membre du bureau')).toBeVisible()
    expect(within(ligne).getByText('Prospect')).toBeVisible()
    expect(within(ligne).getByText('Faible')).toBeVisible()
    expect(screen.queryByText('ANCIEN Paul')).toBeNull() // un mandat terminé ne compte pas
  })

  it('partiel : le niveau s’affiche et signale la personne sans niveau calculé', async () => {
    listerSimule.mockResolvedValue(
      vue(
        [lien({}), lien({ id: 'l2', individual_tier_id: 'p2', nom: 'TRAORE Awa', niveau_risque: null })],
        ELEVE,
      ),
    )

    afficher()

    expect(
      await screen.findByText('1 personne liée n’a pas de niveau de risque calculé : TRAORE Awa.'),
    ).toBeVisible()
    expect(screen.getByText('Non évalué')).toBeVisible()
  })

  it('non évalué : aucun niveau inventé, et l’action qui remplira l’écran', async () => {
    listerSimule.mockResolvedValue(
      vue([], { niveau: null, explication: '', origine: null, provisoire: true }),
    )

    afficher()

    expect(await screen.findByText(/Niveau non évalué/)).toBeVisible()
    expect(screen.getByText(/dans l’onglet « Personnes liées »/)).toBeVisible()
    expect(screen.queryByText(/Niveau de risque :/)).toBeNull()
  })

  it('erreur : message métier et Réessayer', async () => {
    listerSimule.mockRejectedValueOnce(new Error('réseau'))
    listerSimule.mockResolvedValue(vue([lien({})], ELEVE))

    afficher()
    expect(await screen.findByText('Impossible de charger les personnes liées.')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByText(/hérité de BOUBACAR Idrissa/)).toBeVisible()
  })

  it('chargement : message de chargement', () => {
    listerSimule.mockReturnValue(new Promise(() => undefined))

    afficher()

    expect(screen.getByText('Chargement des personnes liées…')).toBeVisible()
  })
})
