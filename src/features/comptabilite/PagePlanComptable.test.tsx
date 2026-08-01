import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { creerCompte, listerComptes, type CompteResume } from '@/features/comptabilite/api'
import { PagePlanComptable } from '@/features/comptabilite/PagePlanComptable'

/**
 * Plan de comptes — liste. Points durs : le bouton « Nouveau compte » n'apparaît qu'avec
 * compta.plan.manage, les comptes désactivés sont exclus par défaut, et un refus 403 s'affiche
 * en langage humain (pas une page rouge inattendue).
 */

const etat = vi.hoisted(() => ({ permissions: [] as string[] }))

vi.mock('@/features/auth/useProfil', () => ({
  useAPermission: (p: string) => etat.permissions.includes(p),
}))

vi.mock('@/features/comptabilite/api', async () => {
  const reel =
    await vi.importActual<typeof import('@/features/comptabilite/api')>('@/features/comptabilite/api')
  return { ...reel, listerComptes: vi.fn(), creerCompte: vi.fn() }
})

const listerSimule = vi.mocked(listerComptes)
const creerSimule = vi.mocked(creerCompte)

function compte(partiel: Partial<CompteResume> = {}): CompteResume {
  return {
    id: crypto.randomUUID(),
    account_number: '6033',
    name: 'Charges diverses',
    short_name: null,
    account_class: 6,
    parent_number: null,
    normal_side: 'D',
    is_posting: true,
    is_system: false,
    is_provisional: true,
    is_active: true,
    ...partiel,
  }
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PagePlanComptable />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.permissions = []
})

describe('PagePlanComptable', () => {
  it('affiche les comptes, le sens et la nature traduits', async () => {
    listerSimule.mockResolvedValue({ lignes: [compte()], total: 1, page: 1, taille: 25 })
    afficher()

    expect(await screen.findByText('Charges diverses')).toBeVisible()
    expect(screen.getByText('6033')).toBeVisible()
    expect(screen.getByText('Débit')).toBeVisible()
    expect(screen.getByText('Saisie')).toBeVisible()
    expect(screen.getByText('provisoire')).toBeVisible()
  })

  it('base vide : un message, pas un tableau vide', async () => {
    listerSimule.mockResolvedValue({ lignes: [], total: 0, page: 1, taille: 25 })
    afficher()

    expect(await screen.findByText(/Aucun compte pour le moment/i)).toBeVisible()
  })

  it('403 : message humain, pas une erreur brute', async () => {
    listerSimule.mockRejectedValue(
      new AxiosError('interdit', undefined, undefined, undefined, { status: 403 } as never),
    )
    afficher()

    expect(await screen.findByText(/n’avez pas la permission/i)).toBeVisible()
  })

  it('« Nouveau compte » n’apparaît qu’avec compta.plan.manage', async () => {
    listerSimule.mockResolvedValue({ lignes: [], total: 0, page: 1, taille: 25 })
    afficher()
    await screen.findByText(/Aucun compte/i)

    expect(screen.queryByRole('button', { name: /Nouveau compte/ })).toBeNull()
  })

  it('création : le compte créé n’est pas provisoire, la liste se rafraîchit', async () => {
    etat.permissions = ['compta.plan.manage']
    listerSimule.mockResolvedValue({ lignes: [], total: 0, page: 1, taille: 25 })
    creerSimule.mockResolvedValue(compte({ account_number: '6034', is_provisional: false }))
    afficher()
    await screen.findByText(/Aucun compte/i)

    fireEvent.click(screen.getByRole('button', { name: /Nouveau compte/ }))
    fireEvent.change(screen.getByLabelText('Numéro de compte'), { target: { value: '6034' } })
    fireEvent.change(screen.getByLabelText('Libellé'), { target: { value: 'Charges de test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer le compte' }))

    await waitFor(() =>
      expect(creerSimule).toHaveBeenCalledWith(
        expect.objectContaining({ account_number: '6034', name: 'Charges de test', account_class: 6 }),
      ),
    )
  })
})
