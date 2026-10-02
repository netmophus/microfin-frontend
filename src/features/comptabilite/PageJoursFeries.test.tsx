import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ajouterJourFerie,
  listerJoursFeries,
  supprimerJourFerie,
  type JourFerie,
} from '@/features/comptabilite/api'
import { PageJoursFeries } from '@/features/comptabilite/PageJoursFeries'

/**
 * Jours fériés. Points durs : liste vide -> message dédié, jamais une liste muette ; ajout
 * exige date ET libellé (bouton désactivé sinon) et réinitialise le formulaire après succès ;
 * suppression exige une confirmation explicite avant d'appeler le serveur.
 */

vi.mock('@/features/comptabilite/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/comptabilite/api')>(
    '@/features/comptabilite/api',
  )
  return {
    ...reel,
    listerJoursFeries: vi.fn(),
    ajouterJourFerie: vi.fn(),
    supprimerJourFerie: vi.fn(),
  }
})

const listerSimule = vi.mocked(listerJoursFeries)
const ajouterSimule = vi.mocked(ajouterJourFerie)
const supprimerSimule = vi.mocked(supprimerJourFerie)

function jourFerie(o: Partial<JourFerie> = {}): JourFerie {
  return {
    id: 'jf1',
    date_feriee: '2032-10-07',
    libelle: 'Tabaski',
    created_at: '2032-01-01T00:00:00Z',
    ...o,
  }
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PageJoursFeries />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PageJoursFeries', () => {
  it('affiche la liste des jours fériés de l’année', async () => {
    listerSimule.mockResolvedValue([jourFerie()])
    afficher()

    expect(await screen.findByText('Tabaski')).toBeVisible()
    expect(screen.getByText('07/10/2032')).toBeVisible()
  })

  it('aucun férié : message dédié, pas une liste vide muette', async () => {
    listerSimule.mockResolvedValue([])
    afficher()

    expect(
      await screen.findByText('Aucun jour férié saisi pour cette année.'),
    ).toBeVisible()
  })

  it('le bouton ajouter reste désactivé tant que la date ou le libellé manque', async () => {
    listerSimule.mockResolvedValue([])
    afficher()
    await screen.findByText('Aucun jour férié saisi pour cette année.')

    const bouton = screen.getByRole('button', { name: 'Ajouter' })
    expect(bouton).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2032-10-07' } })
    expect(bouton).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Libellé'), { target: { value: 'Tabaski' } })
    expect(bouton).not.toBeDisabled()
  })

  it('ajoute un jour férié et réinitialise le formulaire après succès', async () => {
    listerSimule
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([jourFerie()])
    ajouterSimule.mockResolvedValue(jourFerie())
    afficher()

    await screen.findByText('Aucun jour férié saisi pour cette année.')
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2032-10-07' } })
    fireEvent.change(screen.getByLabelText('Libellé'), { target: { value: 'Tabaski' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))

    await waitFor(() => expect(ajouterSimule).toHaveBeenCalledWith('2032-10-07', 'Tabaski'))
    await waitFor(() => expect(screen.getByLabelText('Date')).toHaveValue(''))
    expect(screen.getByLabelText('Libellé')).toHaveValue('')
  })

  it('ajout refusé par le serveur : le motif s’affiche en clair', async () => {
    listerSimule.mockResolvedValue([])
    ajouterSimule.mockRejectedValue(
      new AxiosError('rejet', undefined, undefined, undefined, {
        status: 422,
        data: { detail: 'Un jour férié existe déjà pour le 2032-10-07 : pas de doublon.' },
      } as never),
    )
    afficher()

    await screen.findByText('Aucun jour férié saisi pour cette année.')
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2032-10-07' } })
    fireEvent.change(screen.getByLabelText('Libellé'), { target: { value: 'Tabaski' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))

    expect(
      await screen.findByText('Un jour férié existe déjà pour le 2032-10-07 : pas de doublon.'),
    ).toBeVisible()
  })

  it('suppression : exige une confirmation explicite avant d’appeler le serveur', async () => {
    listerSimule.mockResolvedValue([jourFerie()])
    supprimerSimule.mockResolvedValue(undefined)
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer' }))
    expect(supprimerSimule).not.toHaveBeenCalled()
    expect(
      screen.getByText('Supprimer le jour férié « Tabaski » du 07/10/2032 ?'),
    ).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la suppression' }))
    await waitFor(() => expect(supprimerSimule).toHaveBeenCalledWith('jf1'))
  })

  it('annuler la suppression revient à l’affichage normal sans appeler le serveur', async () => {
    listerSimule.mockResolvedValue([jourFerie()])
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(screen.queryByText(/Supprimer le jour férié/)).not.toBeInTheDocument()
    expect(supprimerSimule).not.toHaveBeenCalled()
  })
})
