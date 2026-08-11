import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  assignerGuichetier,
  changerActivationPoste,
  creerPoste,
  listerAssignations,
  listerPostes,
  rattacherComptePoste,
  renommerPoste,
  revoquerAssignation,
  type PosteCaisse,
  type UtilisateurAssigne,
} from '@/features/caisse/api'
import { PagePostes } from '@/features/caisse/PagePostes'
import { listerComptesSelecteur, type CompteSelecteur } from '@/features/comptabilite/api'
import { listerUtilisateurs, type PageUtilisateurs } from '@/features/utilisateurs/api'

/**
 * Postes de caisse (Bloc B). Points durs : deux permissions distinctes gouvernent des actions
 * différentes sur la MÊME ligne (caisse.poste.manage pour le CRUD/l'assignation,
 * compta.plan.manage pour le rattachement comptable) ; motif obligatoire partout ; assignation
 * limitée aux guichetiers de l'agence du poste.
 */

const etat = vi.hoisted(() => ({ permissions: ['caisse.poste.manage'] as string[] }))

vi.mock('@/features/auth/useProfil', () => ({
  useAPermission: (p: string) => etat.permissions.includes(p),
}))

vi.mock('@/features/caisse/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/caisse/api')>(
    '@/features/caisse/api',
  )
  return {
    ...reel,
    listerPostes: vi.fn(),
    creerPoste: vi.fn(),
    renommerPoste: vi.fn(),
    changerActivationPoste: vi.fn(),
    rattacherComptePoste: vi.fn(),
    listerAssignations: vi.fn(),
    assignerGuichetier: vi.fn(),
    revoquerAssignation: vi.fn(),
  }
})

vi.mock('@/features/comptabilite/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/comptabilite/api')>(
    '@/features/comptabilite/api',
  )
  return { ...reel, listerComptesSelecteur: vi.fn() }
})

vi.mock('@/features/utilisateurs/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/utilisateurs/api')>(
    '@/features/utilisateurs/api',
  )
  return { ...reel, listerUtilisateurs: vi.fn() }
})

const listerSimule = vi.mocked(listerPostes)
const creerSimule = vi.mocked(creerPoste)
const renommerSimule = vi.mocked(renommerPoste)
const activationSimulee = vi.mocked(changerActivationPoste)
const rattacherSimule = vi.mocked(rattacherComptePoste)
const assignesSimules = vi.mocked(listerAssignations)
const assignerSimule = vi.mocked(assignerGuichetier)
const revoquerSimule = vi.mocked(revoquerAssignation)
const comptesSimules = vi.mocked(listerComptesSelecteur)
const utilisateursSimules = vi.mocked(listerUtilisateurs)

function poste(o: Partial<PosteCaisse> = {}): PosteCaisse {
  return {
    id: 'p1',
    agency_id: 'ag1',
    agency_nom: 'Siège',
    code: '01',
    libelle: 'Caisse principale',
    compte_caisse_number: '101111',
    compte_caisse_name: 'Caisse (agence)',
    is_active: true,
    ...o,
  }
}

const comptesSelecteur: CompteSelecteur[] = [
  { id: 'c1', account_number: '101111', name: 'Caisse (agence)' },
  { id: 'c2', account_number: '101112', name: 'Caisse secondaire' },
]

const pageUtilisateursVide: PageUtilisateurs = { lignes: [], total: 0, page: 1, taille: 100 }

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PagePostes />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.permissions = ['caisse.poste.manage']
  comptesSimules.mockResolvedValue(comptesSelecteur)
  assignesSimules.mockResolvedValue([])
  utilisateursSimules.mockResolvedValue(pageUtilisateursVide)
})

describe('PagePostes', () => {
  it('liste vide : le dit clairement', async () => {
    listerSimule.mockResolvedValue([])
    afficher()

    expect(await screen.findByText('Aucun poste de caisse.')).toBeVisible()
  })

  it('403 : message humain', async () => {
    listerSimule.mockRejectedValue(
      new AxiosError('interdit', undefined, undefined, undefined, { status: 403 } as never),
    )
    afficher()

    expect(await screen.findByText(/n’avez pas la permission/i)).toBeVisible()
  })

  it('affiche agence, poste, compte et statut', async () => {
    listerSimule.mockResolvedValue([poste()])
    afficher()

    expect(await screen.findByText('Siège')).toBeVisible()
    expect(screen.getByText('Caisse principale')).toBeVisible()
    expect(screen.getByText('101111 — Caisse (agence)')).toBeVisible()
    expect(screen.getByText('Actif')).toBeVisible()
  })

  it('poste non rattaché : le dit, pas un vide silencieux', async () => {
    listerSimule.mockResolvedValue([poste({ compte_caisse_number: null, compte_caisse_name: null })])
    afficher()

    expect(await screen.findByText('— non rattaché —')).toBeVisible()
  })

  it('sans caisse.poste.manage : ni Ajouter, ni Renommer, ni (dés)activer, ni Guichetiers', async () => {
    etat.permissions = ['compta.plan.manage']
    listerSimule.mockResolvedValue([poste()])
    afficher()
    await screen.findByText('Caisse principale')

    expect(screen.queryByRole('button', { name: 'Ajouter un poste' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Renommer' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Désactiver' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Guichetiers' })).toBeNull()
    // Le rattachement comptable, lui, reste visible (permission distincte).
    expect(screen.getByRole('button', { name: 'Rattacher un compte' })).toBeVisible()
  })

  it('sans compta.plan.manage : pas de « Rattacher un compte »', async () => {
    etat.permissions = ['caisse.poste.manage']
    listerSimule.mockResolvedValue([poste()])
    afficher()
    await screen.findByText('Caisse principale')

    expect(screen.queryByRole('button', { name: 'Rattacher un compte' })).toBeNull()
  })

  it('créer un poste : bloqué sans motif, puis enregistre', async () => {
    listerSimule.mockResolvedValue([])
    creerSimule.mockResolvedValue(poste({ code: '02', libelle: 'Guichet 2' }))
    afficher()
    await screen.findByText('Aucun poste de caisse.')

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un poste' }))
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: '02' } })
    fireEvent.change(screen.getByLabelText('Libellé'), { target: { value: 'Guichet 2' } })

    const enregistrer = screen.getByRole('button', { name: 'Enregistrer' })
    expect(enregistrer).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Motif (obligatoire)'), {
      target: { value: 'ouverture du second guichet' },
    })
    fireEvent.click(enregistrer)

    await waitFor(() =>
      expect(creerSimule).toHaveBeenCalledWith('02', 'Guichet 2', 'ouverture du second guichet'),
    )
  })

  it('renommer un poste existant', async () => {
    listerSimule.mockResolvedValue([poste()])
    renommerSimule.mockResolvedValue(poste({ libelle: 'Nouveau nom' }))
    afficher()
    await screen.findByText('Caisse principale')

    fireEvent.click(screen.getByRole('button', { name: 'Renommer' }))
    const libelle = screen.getByLabelText('Libellé')
    fireEvent.change(libelle, { target: { value: 'Nouveau nom' } })
    fireEvent.change(screen.getByLabelText('Motif (obligatoire)'), {
      target: { value: 'correction du libellé' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() =>
      expect(renommerSimule).toHaveBeenCalledWith('p1', '01', 'Nouveau nom', 'correction du libellé'),
    )
  })

  it('désactivation : demande confirmation ET motif avant d’agir', async () => {
    listerSimule.mockResolvedValue([poste()])
    activationSimulee.mockResolvedValue(poste({ is_active: false }))
    afficher()
    await screen.findByText('Caisse principale')

    fireEvent.click(screen.getByRole('button', { name: 'Désactiver' }))
    expect(await screen.findByText(/Confirmer la désactivation/)).toBeVisible()
    expect(activationSimulee).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Motif (obligatoire)'), {
      target: { value: 'fermeture du guichet' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Désactiver' }))

    await waitFor(() =>
      expect(activationSimulee).toHaveBeenCalledWith('p1', false, 'fermeture du guichet'),
    )
  })

  it('rattachement comptable : enregistre le compte choisi', async () => {
    etat.permissions = ['caisse.poste.manage', 'compta.plan.manage']
    listerSimule.mockResolvedValue([poste({ compte_caisse_number: null, compte_caisse_name: null })])
    rattacherSimule.mockResolvedValue(poste())
    afficher()
    await screen.findByText('Caisse principale')

    fireEvent.click(screen.getByRole('button', { name: 'Rattacher un compte' }))
    fireEvent.change(screen.getByLabelText('Compte de caisse'), { target: { value: '101111' } })
    fireEvent.change(screen.getByLabelText('Motif (obligatoire)'), {
      target: { value: 'rattachement initial' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() =>
      expect(rattacherSimule).toHaveBeenCalledWith('p1', '101111', 'rattachement initial'),
    )
  })

  it('assignations : déplie, affiche les guichetiers, assigne et retire', async () => {
    listerSimule.mockResolvedValue([poste()])
    const guichetier: UtilisateurAssigne = {
      id: 'u1', matricule: 'MAT-1', username: 'g1', nom_complet: 'Awa Souley',
    }
    assignesSimules.mockResolvedValueOnce([]).mockResolvedValue([guichetier])
    utilisateursSimules.mockResolvedValue({
      lignes: [
        { id: 'u1', matricule: 'MAT-1', username: 'g1', email: 'g1@ex.com', last_name: 'Souley', first_name: 'Awa', agence: null, is_active: true, is_locked: false },
      ],
      total: 1, page: 1, taille: 100,
    })
    assignerSimule.mockResolvedValue([guichetier])
    afficher()
    await screen.findByText('Caisse principale')

    fireEvent.click(screen.getByRole('button', { name: 'Guichetiers' }))
    expect(await screen.findByText('Aucun guichetier assigné à ce poste.')).toBeVisible()

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'u1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Assigner' }))

    await waitFor(() => expect(assignerSimule).toHaveBeenCalledWith('p1', 'u1'))
    expect(await screen.findByText('Awa Souley')).toBeVisible()

    revoquerSimule.mockResolvedValue(undefined)
    assignesSimules.mockResolvedValue([])
    fireEvent.click(screen.getByRole('button', { name: 'Retirer' }))

    await waitFor(() => expect(revoquerSimule).toHaveBeenCalledWith('p1', 'u1'))
  })
})
