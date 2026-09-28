import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  creerRole,
  ErreurEcriture,
  lirePermissionsRole,
  listerPermissions,
  listerRolesHabilitations,
  modifierRole,
  remplacerPermissionsRole,
  supprimerRole,
  type PermissionItem,
  type RoleApercu,
  type RolePermissionsDetail,
} from '@/features/roles/api'
import { PageRolesHabilitations } from '@/features/roles/PageRolesHabilitations'

/**
 * Écran « Rôles et habilitations » — LOT 1 (lecture, AUTONOME de GET /roles/roles.read,
 * incident du 28/09/2026) + LOT 2 (édition, rôles PERSONNALISÉS uniquement). Points durs
 * lot 2 : aucun contrôle d'édition sur un rôle SYSTÈME même avec toutes les permissions,
 * l'aperçu « +X / −Y » avant confirmation, le motif obligatoire, et les messages serveur
 * (409/422) affichés tels quels (garde-fou anti-blocage, code déjà utilisé).
 */

const etat = vi.hoisted(() => ({ permissions: [] as string[] }))

vi.mock('@/features/auth/useProfil', () => ({
  useAPermission: (p: string) => etat.permissions.includes(p),
}))

vi.mock('@/features/roles/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/roles/api')>(
    '@/features/roles/api',
  )
  return {
    ...reel,
    listerRolesHabilitations: vi.fn(),
    lirePermissionsRole: vi.fn(),
    listerPermissions: vi.fn(),
    creerRole: vi.fn(),
    modifierRole: vi.fn(),
    supprimerRole: vi.fn(),
    remplacerPermissionsRole: vi.fn(),
  }
})

const rolesSimules = vi.mocked(listerRolesHabilitations)
const detailSimule = vi.mocked(lirePermissionsRole)
const catalogueSimule = vi.mocked(listerPermissions)
const creerSimule = vi.mocked(creerRole)
const modifierSimule = vi.mocked(modifierRole)
const supprimerSimule = vi.mocked(supprimerRole)
const remplacerPermissionsSimule = vi.mocked(remplacerPermissionsRole)

function unRole(o: Partial<RoleApercu> = {}): RoleApercu {
  return {
    code: 'CAISSIER',
    name: 'Caissier',
    description: 'Opérations de guichet',
    is_system: true,
    nb_permissions: 2,
    ...o,
  }
}

function unDetail(o: Partial<RolePermissionsDetail> = {}): RolePermissionsDetail {
  return {
    code: 'CAISSIER',
    name: 'Caissier',
    description: 'Opérations de guichet',
    is_system: true,
    permissions: [
      { code: 'epargne.operation.deposit', module: 'epargne', description: 'Enregistrer un dépôt' },
      { code: 'caisse.session.open', module: 'caisse', description: 'Ouvrir une session de caisse' },
    ],
    ...o,
  }
}

function unePermissionCatalogue(o: Partial<PermissionItem> = {}): PermissionItem {
  return { code: 'epargne.operation.deposit', module: 'epargne', description: 'Enregistrer un dépôt', ...o }
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PageRolesHabilitations />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.permissions = []
})

describe('PageRolesHabilitations', () => {
  it('liste : affiche le rôle, son badge Système et son nombre de permissions — un seul appel, sans passer par GET /roles', async () => {
    rolesSimules.mockResolvedValue([unRole()])
    afficher()

    expect(await screen.findByText('Caissier')).toBeVisible()
    expect(screen.getByText('CAISSIER')).toBeVisible()
    expect(screen.getByText('Système')).toBeVisible()
    expect(screen.getByText('2 permissions')).toBeVisible()
    expect(detailSimule).not.toHaveBeenCalled()
  })

  it('liste : un rôle personnalisé porte le badge Personnalisé', async () => {
    rolesSimules.mockResolvedValue([unRole({ code: 'TEST', name: 'Test', is_system: false })])
    afficher()

    expect(await screen.findByText('Personnalisé')).toBeVisible()
  })

  it('liste vide : message clair', async () => {
    rolesSimules.mockResolvedValue([])
    afficher()

    expect(await screen.findByText('Aucun rôle.')).toBeVisible()
  })

  it('refus de permission (403) : message distinct de la panne de chargement', async () => {
    rolesSimules.mockRejectedValue(
      new AxiosError('rejet', undefined, undefined, undefined, { status: 403 } as never),
    )
    afficher()

    expect(
      await screen.findByText(
        'Vous n’avez pas la permission de consulter les rôles et habilitations.',
      ),
    ).toBeVisible()
    expect(screen.queryByText('Impossible de charger les rôles. Réessayez dans un instant.')).toBeNull()
  })

  it('panne réseau : message générique, pas le message de permission', async () => {
    rolesSimules.mockRejectedValue(new Error('réseau'))
    afficher()

    expect(
      await screen.findByText('Impossible de charger les rôles. Réessayez dans un instant.'),
    ).toBeVisible()
  })

  it('détail : clic sur un rôle affiche ses permissions groupées par module', async () => {
    rolesSimules.mockResolvedValue([unRole()])
    detailSimule.mockResolvedValue(unDetail())
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: /Caissier/ }))

    expect(await screen.findByText('Épargne')).toBeVisible()
    expect(screen.getByText('Caisse')).toBeVisible()
    expect(screen.getByText('epargne.operation.deposit')).toBeVisible()
    expect(screen.getByText(/Enregistrer un dépôt/)).toBeVisible()
  })

  it('détail : rôle introuvable (404) — message dédié', async () => {
    rolesSimules.mockResolvedValue([unRole()])
    detailSimule.mockRejectedValueOnce(
      new AxiosError('rejet', undefined, undefined, undefined, { status: 404 } as never),
    )
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: /Caissier/ }))

    expect(await screen.findByText('Ce rôle est introuvable.')).toBeVisible()
  })

  it('retour : revient à la liste', async () => {
    rolesSimules.mockResolvedValue([unRole()])
    detailSimule.mockResolvedValue(unDetail())
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: /Caissier/ }))
    expect(await screen.findByText('Permissions accordées')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Retour à la liste' }))

    expect(await screen.findByText('2 permissions')).toBeVisible()
  })

  it('rôle sans permission : le dit explicitement', async () => {
    rolesSimules.mockResolvedValue([unRole()])
    detailSimule.mockResolvedValue(unDetail({ permissions: [] }))
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: /Caissier/ }))

    expect(await screen.findByText('Ce rôle ne détient aucune permission.')).toBeVisible()
  })
})

describe('PageRolesHabilitations — lot 2 (édition, rôles personnalisés)', () => {
  it('sans roles.create : pas de bouton de création dans la liste', async () => {
    rolesSimules.mockResolvedValue([unRole()])
    afficher()

    await screen.findByText('Caissier')
    expect(screen.queryByRole('button', { name: 'Créer un rôle personnalisé' })).toBeNull()
  })

  it('roles.create : crée un rôle et bascule vers son détail', async () => {
    etat.permissions = ['roles.create']
    rolesSimules.mockResolvedValue([unRole()])
    creerSimule.mockResolvedValue({
      code: 'ROLE_TEST',
      name: 'Rôle de test',
      description: null,
      is_system: false,
      nb_permissions: 0,
    })
    detailSimule.mockResolvedValue(
      unDetail({ code: 'ROLE_TEST', name: 'Rôle de test', is_system: false, permissions: [] }),
    )
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Créer un rôle personnalisé' }))
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'role_test' } })
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Rôle de test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer le rôle' }))

    await waitFor(() =>
      expect(creerSimule).toHaveBeenCalledWith({
        code: 'ROLE_TEST',
        name: 'Rôle de test',
        description: null,
      }),
    )
    expect(await screen.findByText('Permissions accordées')).toBeVisible()
  })

  it('création : le code déjà utilisé (409) s’affiche tel quel', async () => {
    etat.permissions = ['roles.create']
    rolesSimules.mockResolvedValue([])
    creerSimule.mockRejectedValue(
      new ErreurEcriture({ type: 'conflit', message: 'Le code « CAISSIER » est déjà utilisé.' }),
    )
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Créer un rôle personnalisé' }))
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'CAISSIER' } })
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Doublon' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer le rôle' }))

    expect(await screen.findByText('Le code « CAISSIER » est déjà utilisé.')).toBeVisible()
  })

  it('rôle SYSTÈME : aucun contrôle d’édition, même avec toutes les permissions lot 2', async () => {
    etat.permissions = ['roles.update', 'roles.permissions.manage', 'roles.delete']
    rolesSimules.mockResolvedValue([unRole()])
    detailSimule.mockResolvedValue(unDetail({ is_system: true }))
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: /Caissier/ }))
    await screen.findByText('Permissions accordées')

    expect(screen.queryByText('Nom et description')).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Supprimer ce rôle' })).toBeNull()
    // La liste lecture seule d'origine (lot 1) reste affichée.
    expect(screen.getByText('epargne.operation.deposit')).toBeVisible()
  })

  it('rôle personnalisé + roles.update : modifie le nom, bouton désactivé sans changement', async () => {
    etat.permissions = ['roles.update']
    rolesSimules.mockResolvedValue([unRole({ is_system: false })])
    detailSimule.mockResolvedValue(unDetail({ is_system: false }))
    modifierSimule.mockResolvedValue({
      code: 'CAISSIER',
      name: 'Nouveau nom',
      description: null,
      is_system: false,
      nb_permissions: 2,
    })
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: /Caissier/ }))
    const enregistrer = await screen.findByRole('button', { name: 'Enregistrer' })
    expect(enregistrer).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Nouveau nom' } })
    expect(enregistrer).not.toBeDisabled()
    fireEvent.click(enregistrer)

    await waitFor(() =>
      expect(modifierSimule).toHaveBeenCalledWith('CAISSIER', {
        name: 'Nouveau nom',
        description: 'Opérations de guichet',
      }),
    )
  })

  it('rôle personnalisé + roles.permissions.manage : aperçu +/− puis confirmation', async () => {
    etat.permissions = ['roles.permissions.manage']
    rolesSimules.mockResolvedValue([unRole({ is_system: false })])
    detailSimule.mockResolvedValue(unDetail({ is_system: false }))
    catalogueSimule.mockResolvedValue([
      unePermissionCatalogue(),
      unePermissionCatalogue({ code: 'caisse.session.open', module: 'caisse', description: 'Ouvrir une session de caisse' }),
      unePermissionCatalogue({ code: 'tiers.read.basic', module: 'tiers', description: 'Consulter un tiers' }),
    ])
    remplacerPermissionsSimule.mockResolvedValue(
      unDetail({
        is_system: false,
        permissions: [
          { code: 'tiers.read.basic', module: 'tiers', description: 'Consulter un tiers' },
        ],
      }),
    )
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: /Caissier/ }))
    // Décoche epargne.operation.deposit (initialement détenue), coche tiers.read.basic.
    fireEvent.click(await screen.findByLabelText(/epargne\.operation\.deposit/))
    fireEvent.click(screen.getByLabelText(/tiers\.read\.basic/))
    fireEvent.change(screen.getByLabelText('Motif de la modification'), {
      target: { value: 'Ajustement du périmètre' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier les changements' }))

    expect(await screen.findByText('+1 accordée / −1 retirée')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Confirmer et enregistrer' }))

    await waitFor(() =>
      expect(remplacerPermissionsSimule).toHaveBeenCalledWith(
        'CAISSIER',
        expect.arrayContaining(['caisse.session.open', 'tiers.read.basic']),
        'Ajustement du périmètre',
      ),
    )
  })

  it('garde-fou anti-blocage (422) : message serveur affiché tel quel', async () => {
    etat.permissions = ['roles.permissions.manage']
    rolesSimules.mockResolvedValue([unRole({ is_system: false })])
    detailSimule.mockResolvedValue(unDetail({ is_system: false }))
    catalogueSimule.mockResolvedValue([unePermissionCatalogue()])
    remplacerPermissionsSimule.mockRejectedValue(
      new ErreurEcriture({
        type: 'invalide',
        message:
          "Impossible d'enregistrer : plus aucun rôle ne pourrait gérer les permissions après ce changement. Il doit toujours en rester au moins un.",
      }),
    )
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: /Caissier/ }))
    fireEvent.click(await screen.findByLabelText(/epargne\.operation\.deposit/))
    fireEvent.change(screen.getByLabelText('Motif de la modification'), {
      target: { value: 'Retrait' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier les changements' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer et enregistrer' }))

    expect(
      await screen.findByText(/plus aucun rôle ne pourrait gérer les permissions/),
    ).toBeVisible()
  })

  it('rôle personnalisé + roles.delete : confirmation puis suppression', async () => {
    etat.permissions = ['roles.delete']
    rolesSimules.mockResolvedValue([unRole({ is_system: false })])
    detailSimule.mockResolvedValue(unDetail({ is_system: false }))
    supprimerSimule.mockResolvedValue(undefined)
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: /Caissier/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer ce rôle' }))

    expect(await screen.findByText('Supprimer le rôle « Caissier » ?')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer définitivement' }))

    await waitFor(() => expect(supprimerSimule).toHaveBeenCalledWith('CAISSIER'))
    // Retour à la liste après suppression.
    expect(await screen.findByText('2 permissions')).toBeVisible()
  })
})
