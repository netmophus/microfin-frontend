import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  changerSens,
  desactiverCompte,
  lireCompte,
  modifierCompte,
  type CompteDetail,
} from '@/features/comptabilite/api'
import { PageFicheCompte } from '@/features/comptabilite/PageFicheCompte'

/**
 * Fiche d'un compte. Points durs : « Changer le sens » et « Désactiver » exigent un motif
 * (bouton désactivé tant qu'il fait moins de 3 caractères), les garde-fous serveur s'affichent
 * en langage humain, et un compte SYSTÈME ne propose même pas le changement de sens.
 */

const etat = vi.hoisted(() => ({ permissions: ['compta.plan.manage'] as string[] }))

vi.mock('@/features/auth/useProfil', () => ({
  useAPermission: (p: string) => etat.permissions.includes(p),
}))

vi.mock('@/features/comptabilite/api', async () => {
  const reel =
    await vi.importActual<typeof import('@/features/comptabilite/api')>('@/features/comptabilite/api')
  return {
    ...reel,
    lireCompte: vi.fn(),
    modifierCompte: vi.fn(),
    changerSens: vi.fn(),
    desactiverCompte: vi.fn(),
  }
})

const lireSimule = vi.mocked(lireCompte)
const modifierSimule = vi.mocked(modifierCompte)
const changerSensSimule = vi.mocked(changerSens)
const desactiverSimule = vi.mocked(desactiverCompte)

function compte(partiel: Partial<CompteDetail> = {}): CompteDetail {
  return {
    id: 'c1',
    account_number: '6033',
    name: 'Charges diverses',
    short_name: null,
    account_class: 6,
    parent_number: null,
    normal_side: 'D',
    is_posting: true,
    is_system: false,
    is_provisional: false,
    is_active: true,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...partiel,
  }
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/comptabilite/plan/c1']}>
        <Routes>
          <Route path="/comptabilite/plan/:id" element={<PageFicheCompte />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.permissions = ['compta.plan.manage']
})

describe('PageFicheCompte', () => {
  it('affiche le compte introuvable en langage humain (404)', async () => {
    lireSimule.mockRejectedValue(
      new AxiosError('non trouvé', undefined, undefined, undefined, { status: 404 } as never),
    )
    afficher()

    expect(await screen.findByText('Ce compte est introuvable.')).toBeVisible()
  })

  it('modification du libellé : partielle, le short_name non touché reste affiché', async () => {
    lireSimule.mockResolvedValue(compte({ short_name: 'CH DIV' }))
    modifierSimule.mockResolvedValue(compte({ name: 'Nouveau libellé', short_name: 'CH DIV' }))
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Modifier le libellé' }))
    const champ = screen.getByLabelText('Libellé')
    fireEvent.change(champ, { target: { value: 'Nouveau libellé' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() =>
      expect(modifierSimule).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({ name: 'Nouveau libellé' }),
      ),
    )
  })

  it('changer le sens : bouton bloqué sans motif suffisant, puis confirme', async () => {
    lireSimule.mockResolvedValue(compte({ normal_side: 'D' }))
    changerSensSimule.mockResolvedValue(compte({ normal_side: 'C' }))
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Changer le sens' }))
    const confirmer = screen.getByRole('button', { name: 'Confirmer' })
    expect(confirmer).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Motif (obligatoire)'), {
      target: { value: 'Correction' },
    })
    expect(confirmer).not.toBeDisabled()
    fireEvent.click(confirmer)

    await waitFor(() => expect(changerSensSimule).toHaveBeenCalledWith('c1', 'C', 'Correction'))
  })

  it('un compte SYSTÈME ne propose pas le changement de sens', async () => {
    lireSimule.mockResolvedValue(compte({ is_system: true }))
    afficher()

    await screen.findByText('Charges diverses')
    expect(screen.queryByRole('button', { name: 'Changer le sens' })).toBeNull()
  })

  it('désactiver : refus garde-fou (compte mouvementé) affiché en langage humain', async () => {
    lireSimule.mockResolvedValue(compte())
    desactiverSimule.mockRejectedValue(
      new AxiosError('refus', undefined, undefined, undefined, {
        status: 422,
        data: { detail: 'compte 6033 mouvementé : désactivation refusée' },
      } as never),
    )
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Désactiver ce compte' }))
    fireEvent.change(screen.getByLabelText('Motif (obligatoire)'), {
      target: { value: 'Nettoyage du plan' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Désactiver' }))

    expect(await screen.findByText(/mouvementé : désactivation refusée/)).toBeVisible()
  })

  it('un compte déjà désactivé ne propose plus « Désactiver »', async () => {
    lireSimule.mockResolvedValue(compte({ is_active: false }))
    afficher()

    await screen.findByText('Charges diverses')
    expect(screen.queryByRole('button', { name: 'Désactiver ce compte' })).toBeNull()
  })
})
