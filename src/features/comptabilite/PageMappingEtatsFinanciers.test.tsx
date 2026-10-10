import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  creerMapping,
  listerMapping,
  listerOrphelinsMapping,
  modifierMapping,
  type CompteOrphelinMapping,
  type LigneMappingAdmin,
} from '@/features/comptabilite/api'
import { PageMappingEtatsFinanciers } from '@/features/comptabilite/PageMappingEtatsFinanciers'

/**
 * Administration du mapping. Points durs : modifier une ligne bascule en mode édition puis
 * appelle modifierMapping avec les valeurs saisies ; le badge « ajusté à la main » apparaît
 * après une modification réussie ; le filtre texte réduit la liste affichée.
 */

vi.mock('@/features/comptabilite/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/comptabilite/api')>(
    '@/features/comptabilite/api',
  )
  return {
    ...reel,
    listerMapping: vi.fn(),
    modifierMapping: vi.fn(),
    listerOrphelinsMapping: vi.fn(),
    creerMapping: vi.fn(),
  }
})

const listerSimule = vi.mocked(listerMapping)
const modifierSimule = vi.mocked(modifierMapping)
const orphelinsSimule = vi.mocked(listerOrphelinsMapping)
const creerSimule = vi.mocked(creerMapping)

function orphelin(o: Partial<CompteOrphelinMapping> = {}): CompteOrphelinMapping {
  return {
    account_id: 'orph-1',
    account_number: '101100',
    name: 'Coffre',
    account_class: 1,
    parent_number: '1011',
    parent_etat: 'BILAN',
    parent_masse: 'ACTIF',
    parent_poste_libelle: 'Valeurs en caisse',
    parent_poste_ordre: 10,
    ...o,
  }
}

function ligne(o: Partial<LigneMappingAdmin> = {}): LigneMappingAdmin {
  return {
    account_id: 'acc-1',
    account_number: '5521',
    name: 'Réserve générale',
    account_class: 5,
    etat: 'BILAN',
    masse: 'PASSIF',
    poste_libelle: 'Capital, primes et reserves',
    poste_ordre: 10,
    gere_manuellement: false,
    ...o,
  }
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PageMappingEtatsFinanciers />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  orphelinsSimule.mockResolvedValue([])
})

describe('PageMappingEtatsFinanciers', () => {
  it('affiche la liste avec compte, état, masse et poste', async () => {
    listerSimule.mockResolvedValue([ligne()])
    afficher()

    expect(await screen.findByText('5521')).toBeVisible()
    expect(screen.getByText('Réserve générale')).toBeVisible()
    expect(screen.getByText('Capital, primes et reserves')).toBeVisible()
  })

  it('le filtre texte réduit la liste affichée', async () => {
    listerSimule.mockResolvedValue([
      ligne({ account_id: 'a1', account_number: '5521', name: 'Réserve générale' }),
      ligne({ account_id: 'a2', account_number: '58', name: 'Report a nouveau' }),
    ])
    afficher()

    await screen.findByText('5521')
    fireEvent.change(screen.getByLabelText('Rechercher'), { target: { value: '5521' } })

    expect(screen.getByText('5521')).toBeVisible()
    expect(screen.queryByText('58')).not.toBeInTheDocument()
  })

  it('modifier une ligne : bascule en édition, enregistre les nouvelles valeurs', async () => {
    // Le 1er GET nourrit l'affichage initial ; le 2e (déclenché par l'invalidation après succès)
    // simule le serveur ayant pris en compte la modification — le mapping n'expose ce nouvel
    // état QUE via un re-fetch de la liste, jamais via le retour de la mutation elle-même.
    listerSimule
      .mockResolvedValueOnce([ligne()])
      .mockResolvedValueOnce([
        ligne({ poste_libelle: 'Nouveau libelle', gere_manuellement: true }),
      ])
    modifierSimule.mockResolvedValue(
      ligne({ poste_libelle: 'Nouveau libelle', gere_manuellement: true }),
    )
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }))
    const champPoste = screen.getByLabelText('Libellé du poste')
    fireEvent.change(champPoste, { target: { value: 'Nouveau libelle' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Ajusté à la main')).toBeVisible()
    expect(modifierSimule).toHaveBeenCalledWith('acc-1', {
      etat: 'BILAN',
      masse: 'PASSIF',
      poste_libelle: 'Nouveau libelle',
      poste_ordre: 10,
    })
  })

  it('annuler l’édition revient à l’affichage normal sans appeler le serveur', async () => {
    listerSimule.mockResolvedValue([ligne()])
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }))
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(await screen.findByRole('button', { name: 'Modifier' })).toBeVisible()
    expect(modifierSimule).not.toHaveBeenCalled()
  })

  it('n’affiche aucun bandeau quand il n’y a pas d’orphelin', async () => {
    listerSimule.mockResolvedValue([ligne()])
    afficher()

    await screen.findByText('5521')

    expect(screen.queryByText(/sans poste/)).not.toBeInTheDocument()
  })

  it('affiche le bandeau avec le poste que le parent ferait hériter', async () => {
    listerSimule.mockResolvedValue([ligne()])
    orphelinsSimule.mockResolvedValue([
      orphelin(),
      orphelin({
        account_id: 'orph-2',
        account_number: '1T9000',
        name: 'Sans parent mappé',
        parent_number: null,
        parent_etat: null,
        parent_masse: null,
        parent_poste_libelle: null,
        parent_poste_ordre: null,
      }),
    ])
    afficher()

    expect(await screen.findByText('2 comptes sans poste — ils sortiront du bilan')).toBeVisible()
    expect(screen.getByText('Hériterait de : Valeurs en caisse')).toBeVisible()
    expect(screen.getByText('Aucun poste proposé (parent non mappé)')).toBeVisible()
  })

  it('ranger : formulaire prérempli avec le parent, crée la ligne puis le bandeau disparaît', async () => {
    listerSimule.mockResolvedValue([ligne()])
    orphelinsSimule.mockResolvedValueOnce([orphelin()]).mockResolvedValue([])
    creerSimule.mockResolvedValue(ligne({ account_id: 'orph-1', gere_manuellement: true }))
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Ranger' }))
    expect(screen.getByLabelText('Libellé du poste')).toHaveValue('Valeurs en caisse')
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() =>
      expect(creerSimule).toHaveBeenCalledWith('orph-1', {
        etat: 'BILAN',
        masse: 'ACTIF',
        poste_libelle: 'Valeurs en caisse',
        poste_ordre: 10,
      }),
    )
    await waitFor(() => expect(screen.queryByText(/sans poste/)).not.toBeInTheDocument())
  })

  it('ranger un orphelin sans parent mappé : formulaire vide', async () => {
    listerSimule.mockResolvedValue([ligne()])
    orphelinsSimule.mockResolvedValue([
      orphelin({
        parent_etat: null,
        parent_masse: null,
        parent_poste_libelle: null,
        parent_poste_ordre: null,
      }),
    ])
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Ranger' }))

    expect(screen.getByLabelText('Libellé du poste')).toHaveValue('')
  })
})
