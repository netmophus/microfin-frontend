import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  creerPalierSouffrance,
  listerComptesSelecteur,
  listerPaliersSouffrance,
  modifierPalierSouffrance,
  retirerPalierSouffrance,
  type CompteSelecteur,
  type PalierSouffrance,
} from '@/features/comptabilite/api'
import { PagePaliersSouffrance } from '@/features/comptabilite/PagePaliersSouffrance'

/**
 * Paliers de souffrance (CR5a). Points durs : le nombre de lignes est une donnée (ajouter/
 * retirer, pas seulement modifier une ligne fixe), motif obligatoire dans les 3 actions, les
 * deux sélecteurs de compte (encours, dotation) sont indépendants, la liste reste triée.
 */

const etat = vi.hoisted(() => ({ permissions: ['compta.plan.manage'] as string[] }))

vi.mock('@/features/auth/useProfil', () => ({
  useAPermission: (p: string) => etat.permissions.includes(p),
}))

vi.mock('@/features/comptabilite/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/comptabilite/api')>(
    '@/features/comptabilite/api',
  )
  return {
    ...reel,
    listerPaliersSouffrance: vi.fn(),
    creerPalierSouffrance: vi.fn(),
    modifierPalierSouffrance: vi.fn(),
    retirerPalierSouffrance: vi.fn(),
    listerComptesSelecteur: vi.fn(),
  }
})

const listerSimule = vi.mocked(listerPaliersSouffrance)
const creerSimule = vi.mocked(creerPalierSouffrance)
const modifierSimule = vi.mocked(modifierPalierSouffrance)
const retirerSimule = vi.mocked(retirerPalierSouffrance)
const comptesSimule = vi.mocked(listerComptesSelecteur)

function palier(o: Partial<PalierSouffrance> = {}): PalierSouffrance {
  return {
    id: 'p1',
    code: 'DOUTEUX',
    libelle: 'Créance douteuse',
    seuil_jours: 180,
    taux_provision_bp: 5000,
    compte_encours: null,
    compte_dotation: null,
    is_terminal: false,
    is_provisional: true,
    ...o,
  }
}

const comptesSelecteur: CompteSelecteur[] = [
  { id: 'c1', account_number: '2921', name: 'Créances en souffrance' },
  { id: 'c2', account_number: '6641', name: 'Dotations aux provisions' },
]

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PagePaliersSouffrance />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.permissions = ['compta.plan.manage']
  comptesSimule.mockResolvedValue(comptesSelecteur)
})

describe('PagePaliersSouffrance', () => {
  it('affiche les paliers, triés, avec les badges terminal/provisoire', async () => {
    listerSimule.mockResolvedValue([
      palier({ id: 'p1', code: 'IMPAYE', libelle: 'Impayé simple', seuil_jours: 1 }),
      palier({
        id: 'p2', code: 'IRRECOUVRABLE', libelle: 'Créance irrécouvrable', seuil_jours: 365,
        taux_provision_bp: 10000, is_terminal: true,
      }),
    ])
    afficher()

    expect(await screen.findByText('Impayé simple')).toBeVisible()
    expect(screen.getByText('Créance irrécouvrable')).toBeVisible()
    expect(screen.getByText('Terminal (irrécouvrable)')).toBeVisible()
    expect(screen.getAllByText('Provisoire').length).toBe(2)
    expect(screen.getByText('100 %')).toBeVisible()
  })

  it('sans compta.plan.manage : ni Ajouter, ni Modifier, ni Retirer', async () => {
    etat.permissions = []
    listerSimule.mockResolvedValue([palier()])
    afficher()
    await screen.findByText('Créance douteuse')

    expect(screen.queryByRole('button', { name: 'Ajouter un palier' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Modifier' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Retirer' })).toBeNull()
  })

  it('403 : message dédié, pas un écran cassé', async () => {
    listerSimule.mockRejectedValue(
      new AxiosError('interdit', undefined, undefined, undefined, { status: 403 } as never),
    )
    afficher()

    expect(await screen.findByText(/n’avez pas la permission/i)).toBeVisible()
  })

  it('ajouter un palier : formulaire vide, motif obligatoire, envoie les deux comptes indépendamment', async () => {
    listerSimule.mockResolvedValue([])
    creerSimule.mockResolvedValue(palier({ id: 'nouveau', code: 'NOUVEAU' }))
    afficher()
    await screen.findByText('Aucun palier configuré.')

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un palier' }))
    const enregistrer = await screen.findByRole('button', { name: 'Enregistrer' })
    expect(enregistrer).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'NOUVEAU' } })
    fireEvent.change(screen.getByLabelText('Libellé'), { target: { value: 'Palier test' } })
    fireEvent.change(screen.getByLabelText('Seuil (jours)'), { target: { value: '90' } })
    fireEvent.change(
      screen.getByLabelText('Taux de provision (points de base — 10000 = 100 %)'),
      { target: { value: '2500' } },
    )
    fireEvent.change(screen.getByLabelText('Compte d’encours'), { target: { value: '2921' } })
    fireEvent.change(screen.getByLabelText('Motif (obligatoire)'), {
      target: { value: 'Ajout de palier, test' },
    })
    expect(enregistrer).not.toBeDisabled()
    fireEvent.click(enregistrer)

    await waitFor(() =>
      expect(creerSimule).toHaveBeenCalledWith({
        code: 'NOUVEAU',
        libelle: 'Palier test',
        seuil_jours: 90,
        taux_provision_bp: 2500,
        compte_encours: '2921',
        compte_dotation: null,
        is_terminal: false,
        motif: 'Ajout de palier, test',
      }),
    )
  })

  it('modifier un palier existant : pré-rempli, envoie l’état complet', async () => {
    listerSimule.mockResolvedValue([
      palier({ compte_encours: { account_number: '2921', name: 'Créances en souffrance' } }),
    ])
    modifierSimule.mockResolvedValue(palier({ seuil_jours: 200 }))
    afficher()
    await screen.findByText('Créance douteuse')

    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    const seuil = await screen.findByLabelText('Seuil (jours)')
    expect(seuil).toHaveValue('180')

    fireEvent.change(seuil, { target: { value: '200' } })
    fireEvent.change(screen.getByLabelText('Motif (obligatoire)'), {
      target: { value: 'Ajustement du seuil' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() =>
      expect(modifierSimule).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ seuil_jours: 200, compte_encours: '2921' }),
      ),
    )
  })

  it('retirer un palier : motif obligatoire, confirmation nomme le palier', async () => {
    listerSimule.mockResolvedValue([palier()])
    retirerSimule.mockResolvedValue(undefined)
    afficher()
    await screen.findByText('Créance douteuse')

    fireEvent.click(screen.getByRole('button', { name: 'Retirer' }))
    await screen.findByRole('button', { name: 'Confirmer le retrait' })
    expect(screen.getByText('Créance douteuse')).toBeVisible()
    expect(screen.getByText(/DOUTEUX/)).toBeVisible()

    const confirmer = screen.getByRole('button', { name: 'Confirmer le retrait' })
    expect(confirmer).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Motif (obligatoire)'), {
      target: { value: 'Palier créé par erreur' },
    })
    expect(confirmer).not.toBeDisabled()
    fireEvent.click(confirmer)

    await waitFor(() =>
      expect(retirerSimule).toHaveBeenCalledWith('p1', 'Palier créé par erreur'),
    )
  })

  it('refus serveur (seuil déjà utilisé) affiché en langage humain', async () => {
    listerSimule.mockResolvedValue([])
    creerSimule.mockRejectedValue(
      new AxiosError('rejet', undefined, undefined, undefined, {
        status: 422,
        data: { detail: 'Le seuil de 90 jour(s) est déjà utilisé par le palier « Existant ».' },
      } as never),
    )
    afficher()
    await screen.findByText('Aucun palier configuré.')

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un palier' }))
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'X' } })
    fireEvent.change(screen.getByLabelText('Libellé'), { target: { value: 'X' } })
    fireEvent.change(screen.getByLabelText('Seuil (jours)'), { target: { value: '90' } })
    fireEvent.change(
      screen.getByLabelText('Taux de provision (points de base — 10000 = 100 %)'),
      { target: { value: '0' } },
    )
    fireEvent.change(screen.getByLabelText('Motif (obligatoire)'), {
      target: { value: 'Tentative de doublon' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(
      await screen.findByText('Le seuil de 90 jour(s) est déjà utilisé par le palier « Existant ».'),
    ).toBeVisible()
  })
})
