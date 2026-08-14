import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  lireParametresCaisse,
  modifierParametresCaisse,
  type ParametresCaisse,
} from '@/features/caisse/api'
import { PageParametresCaisse } from '@/features/comptabilite/PageParametresCaisse'

/**
 * Seuil de tolérance de caisse (CA2, Bloc 5). Points durs : motif obligatoire à la
 * modification, une config absente (404) affiche un message humain plutôt qu'un écran cassé,
 * « Modifier » n'apparaît qu'avec compta.plan.manage.
 */

const etat = vi.hoisted(() => ({ permissions: ['compta.plan.manage'] as string[] }))

vi.mock('@/features/auth/useProfil', () => ({
  useAPermission: (p: string) => etat.permissions.includes(p),
}))

vi.mock('@/features/caisse/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/caisse/api')>('@/features/caisse/api')
  return {
    ...reel,
    lireParametresCaisse: vi.fn(),
    modifierParametresCaisse: vi.fn(),
  }
})

const lireSimule = vi.mocked(lireParametresCaisse)
const modifierSimule = vi.mocked(modifierParametresCaisse)

function config(partiel: Partial<ParametresCaisse> = {}): ParametresCaisse {
  return { seuil_tolerance: 500, is_provisional: true, ...partiel }
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PageParametresCaisse />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.permissions = ['compta.plan.manage']
})

describe('PageParametresCaisse', () => {
  it('affiche le seuil et le badge provisoire', async () => {
    lireSimule.mockResolvedValue(config())
    afficher()

    expect(await screen.findByText('500 F')).toBeVisible()
    expect(screen.getByText('provisoire')).toBeVisible()
  })

  it('404 : « pas encore paramétré », pas un écran cassé', async () => {
    lireSimule.mockRejectedValue(
      new AxiosError('non trouvé', undefined, undefined, undefined, { status: 404 } as never),
    )
    afficher()

    expect(await screen.findByText(/n.est pas encore paramétré/i)).toBeVisible()
  })

  it('« Modifier » absent sans compta.plan.manage', async () => {
    etat.permissions = []
    lireSimule.mockResolvedValue(config())
    afficher()
    await screen.findByText('500 F')

    expect(screen.queryByRole('button', { name: 'Modifier' })).toBeNull()
  })

  it('édition : motif obligatoire, enregistre le nouveau seuil', async () => {
    lireSimule.mockResolvedValue(config())
    modifierSimule.mockResolvedValue(config({ seuil_tolerance: 1000 }))
    afficher()
    await screen.findByText('500 F')

    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    const enregistrer = await screen.findByRole('button', { name: 'Enregistrer' })
    expect(enregistrer).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Seuil de tolérance (francs CFA)'), {
      target: { value: '1000' },
    })
    expect(enregistrer).toBeDisabled() // motif encore vide

    fireEvent.change(screen.getByLabelText('Motif (obligatoire)'), {
      target: { value: 'Révision institutionnelle' },
    })
    expect(enregistrer).not.toBeDisabled()
    fireEvent.click(enregistrer)

    await waitFor(() =>
      expect(modifierSimule).toHaveBeenCalledWith(1000, 'Révision institutionnelle'),
    )
  })
})
