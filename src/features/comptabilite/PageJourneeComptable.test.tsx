import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  chargerJourneeCourante,
  cloturerJournee,
  listerJournees,
  ouvrirJournee,
  type JourneeComptable,
  type JourneeCourante,
} from '@/features/comptabilite/api'
import { PageJourneeComptable } from '@/features/comptabilite/PageJourneeComptable'

/**
 * Journée comptable. Points durs : aucune journée ouverte -> formulaire pré-rempli avec la
 * date proposée, modifiable ; journée ouverte -> date + acteur affichés, pas de second
 * formulaire d'ouverture ; clôture définitive -> confirmation explicite avant l'appel serveur ;
 * historique jamais vide muet ; réorganisation RBAC post lot 4b -> les boutons Ouvrir/Clôturer
 * sont MASQUÉS (pas seulement désactivés) pour un acteur qui n'a que compta.journee.read.
 */

const etat = vi.hoisted(() => ({
  permissions: ['compta.journee.read', 'compta.journee.manage'] as string[],
}))

vi.mock('@/features/auth/useProfil', () => ({
  useAPermission: (p: string) => etat.permissions.includes(p),
}))

vi.mock('@/features/comptabilite/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/comptabilite/api')>(
    '@/features/comptabilite/api',
  )
  return {
    ...reel,
    chargerJourneeCourante: vi.fn(),
    listerJournees: vi.fn(),
    ouvrirJournee: vi.fn(),
    cloturerJournee: vi.fn(),
  }
})

const couranteSimulee = vi.mocked(chargerJourneeCourante)
const listerSimule = vi.mocked(listerJournees)
const ouvrirSimule = vi.mocked(ouvrirJournee)
const cloturerSimule = vi.mocked(cloturerJournee)

function journee(o: Partial<JourneeComptable> = {}): JourneeComptable {
  return {
    id: 'j1',
    date_comptable: '2031-06-02',
    status: 'ouverte',
    opened_at: '2031-05-30T08:00:00Z',
    opened_par_nom: 'Awa Comptable',
    closed_at: null,
    closed_par_nom: null,
    ...o,
  }
}

function courante(o: Partial<JourneeCourante> = {}): JourneeCourante {
  return { journee: null, prochaine_date_proposee: '2031-06-02', ...o }
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PageJourneeComptable />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.permissions = ['compta.journee.read', 'compta.journee.manage']
  listerSimule.mockResolvedValue([])
})

describe('PageJourneeComptable', () => {
  it('aucune journée ouverte : propose l’ouverture avec la date par défaut', async () => {
    couranteSimulee.mockResolvedValue(courante())
    ouvrirSimule.mockResolvedValue(journee())
    afficher()

    expect(await screen.findByText('Aucune journée comptable n’est ouverte.')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir la journée' }))
    const champDate = screen.getByLabelText('Date comptable') as HTMLInputElement
    expect(champDate.value).toBe('2031-06-02')

    fireEvent.click(screen.getByRole('button', { name: 'Confirmer l’ouverture' }))
    await waitFor(() => expect(ouvrirSimule).toHaveBeenCalledWith('2031-06-02'))
  })

  it('journée ouverte : affiche la date et l’acteur, propose la clôture', async () => {
    couranteSimulee.mockResolvedValue(courante({ journee: journee() }))
    afficher()

    expect(await screen.findByText('Ouverte')).toBeVisible()
    expect(screen.getByText(/02\/06\/2031/)).toBeVisible()
    expect(screen.getByText(/Awa Comptable/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Ouvrir la journée' })).not.toBeInTheDocument()
  })

  it('clôture : exige une confirmation explicite avant d’appeler le serveur', async () => {
    couranteSimulee.mockResolvedValue(courante({ journee: journee() }))
    cloturerSimule.mockResolvedValue(journee({ status: 'cloturee' }))
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Clôturer la journée' }))
    expect(cloturerSimule).not.toHaveBeenCalled()
    expect(screen.getByText(/est DÉFINITIVE/)).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la clôture' }))
    await waitFor(() => expect(cloturerSimule).toHaveBeenCalled())
  })

  it('clôture refusée (caisses encore ouvertes) : le motif du serveur s’affiche en clair (chantier P1bis lot 2)', async () => {
    couranteSimulee.mockResolvedValue(courante({ journee: journee() }))
    cloturerSimule.mockRejectedValue(
      new AxiosError('rejet', undefined, undefined, undefined, {
        status: 422,
        data: {
          detail:
            '2 caisse(s) encore ouverte(s) : fermez-les avant de clôturer la journée comptable.',
        },
      } as never),
    )
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Clôturer la journée' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la clôture' }))

    expect(
      await screen.findByText(
        '2 caisse(s) encore ouverte(s) : fermez-les avant de clôturer la journée comptable.',
      ),
    ).toBeVisible()
  })

  it('historique : affiche les journées, « — » pour l’acteur absent', async () => {
    couranteSimulee.mockResolvedValue(courante())
    listerSimule.mockResolvedValue([
      journee({ id: 'j2', date_comptable: '2031-06-09', closed_par_nom: null }),
      journee({
        id: 'j1',
        date_comptable: '2031-06-02',
        status: 'cloturee',
        closed_par_nom: 'Awa Comptable',
      }),
    ])
    afficher()

    expect(await screen.findByText('09/06/2031')).toBeVisible()
    expect(screen.getByText('02/06/2031')).toBeVisible()
    expect(screen.getByText('Clôturée')).toBeVisible()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('historique vide : message dédié, pas un tableau muet', async () => {
    couranteSimulee.mockResolvedValue(courante())
    afficher()

    expect(await screen.findByText('Aucune journée n’a encore été ouverte.')).toBeVisible()
  })

  it('bouton Ouvrir absent sans compta.journee.manage (réorganisation RBAC post lot 4b)', async () => {
    etat.permissions = ['compta.journee.read']
    couranteSimulee.mockResolvedValue(courante())
    afficher()

    expect(await screen.findByText('Aucune journée comptable n’est ouverte.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Ouvrir la journée' })).not.toBeInTheDocument()
  })

  it('bouton Clôturer absent sans compta.journee.manage (réorganisation RBAC post lot 4b)', async () => {
    etat.permissions = ['compta.journee.read']
    couranteSimulee.mockResolvedValue(courante({ journee: journee() }))
    afficher()

    expect(await screen.findByText('Ouverte')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Clôturer la journée' })).not.toBeInTheDocument()
  })
})
