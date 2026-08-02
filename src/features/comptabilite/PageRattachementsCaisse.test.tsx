import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  listerComptesSelecteur,
  listerRattachementsAgences,
  modifierCompteCaisse,
  type AgenceRattachement,
  type CompteSelecteur,
} from '@/features/comptabilite/api'
import { PageRattachementsCaisse } from '@/features/comptabilite/PageRattachementsCaisse'

/** Caisse par agence (Bloc 5). Même patron que les rattachements épargne, un seul sélecteur. */

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
  }
})

const listerAgencesSimule = vi.mocked(listerRattachementsAgences)
const listerComptesSimule = vi.mocked(listerComptesSelecteur)
const modifierSimule = vi.mocked(modifierCompteCaisse)

function agence(partiel: Partial<AgenceRattachement> = {}): AgenceRattachement {
  return {
    id: 'a1',
    code: 'SIEGE',
    name: 'Siège',
    compte_caisse: { account_number: '5721', name: 'Caisses agences' },
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
      <PageRattachementsCaisse />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.permissions = ['compta.plan.manage']
  listerComptesSimule.mockResolvedValue(comptesSelecteur)
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

    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    const select = await screen.findByLabelText('Compte de caisse')
    fireEvent.change(select, { target: { value: '5722' } })

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
})
