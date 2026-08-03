import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  chargerGrandLivre,
  listerComptesSelecteurRapport,
  type CompteSelecteurRapport,
  type PageGrandLivre as PageGrandLivreDonnees,
} from '@/features/comptabilite/api'
import { PageGrandLivre } from '@/features/comptabilite/PageGrandLivre'

/**
 * Grand livre. Deux points vérifiés explicitement (demandés par l'utilisateur, pas des
 * détails accessoires) :
 *  - tant qu'aucun compte n'est choisi, un texte d'invite EXPLICITE, jamais un vide silencieux ;
 *  - un compte désactivé se signale dans le sélecteur (option) ET dans le résultat affiché
 *    (une fois choisi), même après fermeture du sélecteur — pas seulement au moment du choix.
 */

vi.mock('@/features/comptabilite/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/comptabilite/api')>(
    '@/features/comptabilite/api',
  )
  return { ...reel, listerComptesSelecteurRapport: vi.fn(), chargerGrandLivre: vi.fn() }
})

const listerComptesSimule = vi.mocked(listerComptesSelecteurRapport)
const chargerGrandLivreSimule = vi.mocked(chargerGrandLivre)

const comptes: CompteSelecteurRapport[] = [
  { id: 'c1', account_number: '1011', name: 'Billets et monnaies', is_active: true },
  { id: 'c2', account_number: '6T900', name: 'Compte de test désactivé', is_active: false },
]

function grandLivre(partiel: Partial<PageGrandLivreDonnees> = {}): PageGrandLivreDonnees {
  return {
    compte: { account_number: '6T900', name: 'Compte de test désactivé', is_active: false },
    solde_ouverture: 0,
    lignes: [
      {
        entry_date: '2026-07-01',
        entry_number: 'OD-2026-000001',
        journal_code: 'OD',
        label: 'Mouvement test',
        side: 'D',
        amount: 1000,
        solde_cumule: 1000,
      },
    ],
    total: 1,
    page: 1,
    taille: 50,
    ...partiel,
  }
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PageGrandLivre />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  listerComptesSimule.mockResolvedValue(comptes)
})

describe('PageGrandLivre', () => {
  it("invite explicitement à choisir un compte tant qu'aucun n'est sélectionné", async () => {
    afficher()

    expect(
      await screen.findByText('Choisissez un compte pour voir son grand livre.'),
    ).toBeVisible()
    expect(chargerGrandLivreSimule).not.toHaveBeenCalled()
  })

  it('le sélecteur signale un compte désactivé dans son option', async () => {
    afficher()
    await screen.findByText('1011 — Billets et monnaies')

    expect(screen.getByText('6T900 — Compte de test désactivé (désactivé)')).toBeInTheDocument()
  })

  it('une fois un compte désactivé choisi, le résultat le signale AUSSI (pas juste le menu)', async () => {
    chargerGrandLivreSimule.mockResolvedValue(grandLivre())
    afficher()
    const select = await screen.findByLabelText('Compte')
    // Attendre que l'OPTION existe avant de la choisir : sinon jsdom ignore silencieusement
    // une valeur qui ne correspond à aucune <option> encore montée (course avec la requête).
    await screen.findByText('6T900 — Compte de test désactivé (désactivé)')

    fireEvent.change(select, { target: { value: 'c2' } })

    // Le badge apparaît dans l'EN-TÊTE DU RÉSULTAT, indépendamment du menu déroulant refermé.
    expect(await screen.findByText('Désactivé')).toBeVisible()
    expect(screen.getByText('6T900')).toBeVisible()
  })

  it('affiche le solde cumulé de chaque mouvement', async () => {
    chargerGrandLivreSimule.mockResolvedValue(
      grandLivre({
        lignes: [
          {
            entry_date: '2026-07-01',
            entry_number: 'OD-2026-000001',
            journal_code: 'OD',
            label: 'Mouvement test',
            side: 'D',
            amount: 1000,
            solde_cumule: 1500,
          },
        ],
      }),
    )
    afficher()
    const select = await screen.findByLabelText('Compte')
    await screen.findByText('6T900 — Compte de test désactivé (désactivé)')
    fireEvent.change(select, { target: { value: 'c2' } })

    // Le débit (1000) et le solde cumulé (1500) sont DISTINCTS — pas de confusion possible.
    expect(await screen.findByText('1 000 F')).toBeVisible()
    expect(screen.getByText('1 500 F')).toBeVisible()
  })
})
