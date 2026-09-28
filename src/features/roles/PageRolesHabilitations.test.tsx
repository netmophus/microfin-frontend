import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  lirePermissionsRole,
  listerRolesHabilitations,
  type RoleApercu,
  type RolePermissionsDetail,
} from '@/features/roles/api'
import { PageRolesHabilitations } from '@/features/roles/PageRolesHabilitations'

/**
 * Écran « Rôles et habilitations » — lot 1, LECTURE SEULE, AUTONOME de GET /roles (roles.read).
 * Points durs : la liste vient d'UN SEUL appel (GET /roles/habilitations, pas de
 * listerRoles/GET /roles — un titulaire de roles.permissions.read sans roles.read doit
 * pouvoir tout charger, cf. incident du 28/09/2026), le badge Système distingue bien rôle
 * système et personnalisé, les permissions du détail sont groupées par module avec un
 * libellé humain, et un 403 se distingue d'une panne de chargement.
 */

vi.mock('@/features/roles/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/roles/api')>(
    '@/features/roles/api',
  )
  return { ...reel, listerRolesHabilitations: vi.fn(), lirePermissionsRole: vi.fn() }
})

const rolesSimules = vi.mocked(listerRolesHabilitations)
const detailSimule = vi.mocked(lirePermissionsRole)

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

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PageRolesHabilitations />
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())

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
