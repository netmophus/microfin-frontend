import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  listerComptesSelecteur,
  listerNiveauxCaisse,
  listerRattachementsAgences,
  modifierCompteCaisse,
  rattacherNiveauCaisse,
  type AgenceNiveauxCaisse,
  type AgenceRattachement,
  type CompteSelecteur,
} from '@/features/comptabilite/api'
import { PageRattachementsCaisse } from '@/features/comptabilite/PageRattachementsCaisse'

/**
 * Caisse par agence (Bloc 5) : le rattachement historique + les niveaux coffre/principale
 * (chantier coffre-fort/caisses, sous-chantier 1 Bloc 2). Points durs niveaux : un niveau non
 * paramétré s'affiche explicitement (pas un champ vide), un compte hors 1011 est refusé avec
 * le message serveur affiché tel quel, le niveau secondaire n'apparaît jamais ici.
 */

const etat = vi.hoisted(() => ({ permissions: ['compta.plan.manage'] as string[] }))

vi.mock('@/features/auth/useProfil', () => ({
  useAPermission: (p: string) => etat.permissions.includes(p),
}))

vi.mock('@/features/comptabilite/api', async () => {
  const reel =
    await vi.importActual<typeof import('@/features/comptabilite/api')>(
      '@/features/comptabilite/api',
    )
  return {
    ...reel,
    listerRattachementsAgences: vi.fn(),
    listerComptesSelecteur: vi.fn(),
    modifierCompteCaisse: vi.fn(),
    listerNiveauxCaisse: vi.fn(),
    rattacherNiveauCaisse: vi.fn(),
  }
})

const listerAgencesSimule = vi.mocked(listerRattachementsAgences)
const listerComptesSimule = vi.mocked(listerComptesSelecteur)
const modifierSimule = vi.mocked(modifierCompteCaisse)
const listerNiveauxSimule = vi.mocked(listerNiveauxCaisse)
const rattacherNiveauSimule = vi.mocked(rattacherNiveauCaisse)

function niveauxAgence(partiel: Partial<AgenceNiveauxCaisse> = {}): AgenceNiveauxCaisse {
  return {
    agency_id: 'a1',
    agency_nom: 'Siège',
    niveaux: [
      { niveau: 'coffre', compte_caisse: null },
      { niveau: 'principale', compte_caisse: null },
    ],
    ...partiel,
  }
}

function agence(partiel: Partial<AgenceRattachement> = {}): AgenceRattachement {
  return {
    id: 'a1',
    code: 'SIEGE',
    name: 'Siège',
    compte_caisse: { account_number: '5721', name: 'Caisses agences' },
    postes_divergents: [],
    ...partiel,
  }
}

const comptesSelecteur: CompteSelecteur[] = [
  { id: 'c1', account_number: '5721', name: 'Caisses agences' },
  { id: 'c2', account_number: '5722', name: 'Caisse secondaire' },
]

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PageRattachementsCaisse />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.permissions = ['compta.plan.manage']
  listerComptesSimule.mockResolvedValue(comptesSelecteur)
  listerNiveauxSimule.mockResolvedValue([niveauxAgence()])
})

describe('PageRattachementsCaisse', () => {
  it('affiche le compte de caisse résolu en numéro + libellé', async () => {
    listerAgencesSimule.mockResolvedValue([agence()])
    afficher()

    expect(await screen.findByText('5721 — Caisses agences')).toBeVisible()
  })

  it('base vide : un message', async () => {
    listerAgencesSimule.mockResolvedValue([])
    afficher()

    expect(await screen.findByText(/Aucune agence active/i)).toBeVisible()
  })

  it('403 : message humain', async () => {
    listerAgencesSimule.mockRejectedValue(
      new AxiosError('interdit', undefined, undefined, undefined, { status: 403 } as never),
    )
    afficher()

    expect(await screen.findByText(/n’avez pas la permission/i)).toBeVisible()
  })

  it('« Modifier » absent sans compta.plan.manage', async () => {
    etat.permissions = []
    listerAgencesSimule.mockResolvedValue([agence()])
    afficher()
    await screen.findByText('Siège')

    expect(screen.queryByRole('button', { name: 'Modifier' })).toBeNull()
  })

  it('édition : bloqué sans motif, puis enregistre le nouveau compte', async () => {
    listerAgencesSimule.mockResolvedValue([agence()])
    modifierSimule.mockResolvedValue(
      agence({ compte_caisse: { account_number: '5722', name: 'Caisse secondaire' } }),
    )
    afficher()
    await screen.findByText('Siège')

    // Le premier bouton « Modifier » est celui du rattachement historique (ligne agence) —
    // les niveaux coffre/principale ont chacun le leur, testés séparément plus bas.
    const [boutonModifier] = screen.getAllByRole('button', { name: 'Modifier' })
    if (!boutonModifier) throw new Error('Bouton « Modifier » introuvable')
    fireEvent.click(boutonModifier)
    const champ = await screen.findByLabelText('Compte de caisse')
    fireEvent.change(champ, { target: { value: '5722' } })
    fireEvent.blur(champ)

    const enregistrer = screen.getByRole('button', { name: 'Enregistrer' })
    expect(enregistrer).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Motif (obligatoire)'), {
      target: { value: 'Changement de compte de caisse' },
    })
    fireEvent.click(enregistrer)

    await waitFor(() =>
      expect(modifierSimule).toHaveBeenCalledWith(
        'a1',
        '5722',
        'Changement de compte de caisse',
      ),
    )
  })

  it('signale la divergence avec un poste de caisse (coexistence Bloc A/B)', async () => {
    listerAgencesSimule.mockResolvedValue([
      agence({
        postes_divergents: [
          { code: '01', libelle: 'Caisse principale', compte_caisse: { account_number: '101111', name: 'Caisse (agence)' } },
        ],
      }),
    ])
    afficher()

    expect(
      await screen.findByText(/Diffère du compte de « Caisse principale » \(101111\)/),
    ).toBeVisible()
  })

  it('aucune divergence : aucun avertissement affiché', async () => {
    listerAgencesSimule.mockResolvedValue([agence()])
    afficher()
    await screen.findByText('Siège')

    expect(screen.queryByRole('note')).toBeNull()
  })

  // --- Niveaux coffre/principale (chantier coffre-fort/caisses, sous-chantier 1, Bloc 2) ---

  it('niveaux : coffre et principale affichés, « Non paramétré » explicite', async () => {
    listerAgencesSimule.mockResolvedValue([agence()])
    afficher()

    expect(await screen.findByText('↳ Coffre')).toBeVisible()
    expect(screen.getByText('↳ Principale')).toBeVisible()
    expect(screen.getAllByText('Non paramétré')).toHaveLength(2)
  })

  it('niveaux : un compte déjà rattaché s’affiche résolu', async () => {
    listerAgencesSimule.mockResolvedValue([agence()])
    listerNiveauxSimule.mockResolvedValue([
      niveauxAgence({
        niveaux: [
          { niveau: 'coffre', compte_caisse: { account_number: '101112', name: 'Coffre Siège' } },
          { niveau: 'principale', compte_caisse: null },
        ],
      }),
    ])
    afficher()

    expect(await screen.findByText('101112 — Coffre Siège')).toBeVisible()
    expect(screen.getByText('Non paramétré')).toBeVisible()
  })

  it('niveaux : le niveau secondaire n’apparaît jamais, une note renvoie vers Postes de caisse', async () => {
    listerAgencesSimule.mockResolvedValue([agence()])
    afficher()
    await screen.findByText('↳ Coffre')

    expect(screen.queryByText('↳ Secondaire')).toBeNull()
    expect(screen.getByText(/secondaire/i)).toBeVisible()
    const lien = screen.getByRole('link', { name: 'Postes de caisse' })
    expect(lien).toHaveAttribute('href', '/caisse/postes')
  })

  // Ordre de rendu par agence : [0] rattachement historique, [1] coffre, [2] principale.
  async function ouvrirEditionCoffre(): Promise<void> {
    const boutons = await screen.findAllByRole('button', { name: 'Modifier' })
    const boutonCoffre = boutons[1]
    if (!boutonCoffre) throw new Error('Bouton « Modifier » du coffre introuvable')
    fireEvent.click(boutonCoffre)
  }

  it('niveaux : rattache un compte au niveau coffre', async () => {
    listerAgencesSimule.mockResolvedValue([agence()])
    rattacherNiveauSimule.mockResolvedValue(
      niveauxAgence({
        niveaux: [
          {
            niveau: 'coffre',
            compte_caisse: { account_number: '5722', name: 'Caisse secondaire' },
          },
          { niveau: 'principale', compte_caisse: null },
        ],
      }),
    )
    afficher()
    await ouvrirEditionCoffre()

    const champ = await screen.findByLabelText('Coffre')
    fireEvent.change(champ, { target: { value: '5722' } })
    fireEvent.blur(champ)
    fireEvent.change(screen.getByLabelText('Motif (obligatoire)'), {
      target: { value: 'Ouverture du coffre du Siège' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() =>
      expect(rattacherNiveauSimule).toHaveBeenCalledWith(
        'a1',
        'coffre',
        '5722',
        'Ouverture du coffre du Siège',
      ),
    )
  })

  it('niveaux : compte hors 1011 refusé, message serveur affiché tel quel', async () => {
    listerAgencesSimule.mockResolvedValue([agence()])
    rattacherNiveauSimule.mockRejectedValue(
      new AxiosError('refus', undefined, undefined, undefined, {
        status: 422,
        data: {
          detail:
            'Le compte « 251111 » ne peut pas servir de compte de caisse : il ne dépend pas de la rubrique « 1011 ».',
        },
      } as never),
    )
    afficher()
    await ouvrirEditionCoffre()

    const champ = await screen.findByLabelText('Coffre')
    fireEvent.change(champ, { target: { value: '251111' } })
    fireEvent.blur(champ)
    fireEvent.change(screen.getByLabelText('Motif (obligatoire)'), {
      target: { value: 'Tentative hors 1011' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText(/ne dépend pas de la rubrique « 1011 »/)).toBeVisible()
  })

  it('niveaux : boutons « Modifier » absents sans compta.plan.manage', async () => {
    etat.permissions = []
    listerAgencesSimule.mockResolvedValue([agence()])
    afficher()
    await screen.findByText('↳ Coffre')

    expect(screen.queryAllByRole('button', { name: 'Modifier' })).toHaveLength(0)
  })
})
