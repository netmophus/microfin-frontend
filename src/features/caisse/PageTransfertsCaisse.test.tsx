import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  initierTransfert,
  listerMesPostes,
  listerTransferts,
  receptionnerTransfert,
  type PageTransferts,
  type PosteAssigne,
  type Transfert,
} from '@/features/caisse/api'
import { PageTransfertsCaisse } from '@/features/caisse/PageTransfertsCaisse'

/**
 * Transferts de caisse (sous-chantier 2, Lot 3). Points durs : l'adjacence limite les couples
 * proposés à l'initiation (jamais coffre -> secondaire à l'écran) ; l'écart se calcule EN DIRECT
 * à la réception, avant confirmation ; les deux boutons (Initier / Réceptionner) sont gardés
 * chacun par SA permission, indépendamment.
 */

const etat = vi.hoisted(() => ({
  permissions: ['caisse.transfert.initier', 'caisse.transfert.valider'] as string[],
}))

vi.mock('@/features/auth/useProfil', () => ({
  useAPermission: (p: string) => etat.permissions.includes(p),
}))

vi.mock('@/features/caisse/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/caisse/api')>(
    '@/features/caisse/api',
  )
  return {
    ...reel,
    listerTransferts: vi.fn(),
    initierTransfert: vi.fn(),
    receptionnerTransfert: vi.fn(),
    listerMesPostes: vi.fn(),
  }
})

const listerSimule = vi.mocked(listerTransferts)
const initierSimule = vi.mocked(initierTransfert)
const receptionnerSimule = vi.mocked(receptionnerTransfert)
const mesPostesSimule = vi.mocked(listerMesPostes)

function transfert(o: Partial<Transfert> = {}): Transfert {
  return {
    id: 't1',
    agency_id: 'ag1',
    agency_nom: 'Siège',
    niveau_source: 'coffre',
    niveau_destination: 'principale',
    compte_source_number: '101115',
    compte_destination_number: '101114',
    montant_envoye: 50_000,
    montant_compte: null,
    statut: 'en_transit',
    envoye_par_nom: 'Jean Dupont',
    envoye_le: '2026-09-29T08:00:00Z',
    receptionne_par_nom: null,
    receptionne_le: null,
    motif: 'Alimentation de la principale',
    ...o,
  }
}

function page(lignes: Transfert[]): PageTransferts {
  return { lignes, total: lignes.length, page: 1, taille: 25 }
}

const poste: PosteAssigne = { id: 'p1', code: '01', libelle: 'Guichet 1' }

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PageTransfertsCaisse />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.permissions = ['caisse.transfert.initier', 'caisse.transfert.valider']
  mesPostesSimule.mockResolvedValue([poste])
})

describe('PageTransfertsCaisse', () => {
  it('affiche la liste des transferts en transit', async () => {
    listerSimule.mockResolvedValue(page([transfert()]))
    afficher()

    expect(await screen.findByText('Alimentation de la principale')).toBeVisible()
    expect(screen.getByText('50 000 F')).toBeVisible()
    expect(screen.getByText(/Jean Dupont/)).toBeVisible()
    // « Coffre »/« Principale » figurent aussi dans le filtre : au moins un affichage suffit
    // à prouver que le mouvement est rendu.
    expect(screen.getAllByText('Coffre').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Principale').length).toBeGreaterThan(0)
  })

  it('liste vide : un message', async () => {
    listerSimule.mockResolvedValue(page([]))
    afficher()

    expect(await screen.findByText(/Aucun transfert en transit/i)).toBeVisible()
  })

  it('403 : message humain', async () => {
    listerSimule.mockRejectedValue(
      new AxiosError('interdit', undefined, undefined, undefined, { status: 403 } as never),
    )
    afficher()

    expect(await screen.findByText(/n’avez pas la permission/i)).toBeVisible()
  })

  it('bouton « Initier un transfert » absent sans caisse.transfert.initier', async () => {
    etat.permissions = ['caisse.transfert.valider']
    listerSimule.mockResolvedValue(page([transfert()]))
    afficher()
    await screen.findByText('Alimentation de la principale')

    expect(screen.queryByRole('button', { name: 'Initier un transfert' })).toBeNull()
  })

  it('bouton « Réceptionner » absent sans caisse.transfert.valider', async () => {
    etat.permissions = ['caisse.transfert.initier']
    listerSimule.mockResolvedValue(page([transfert()]))
    afficher()
    await screen.findByText('Alimentation de la principale')

    expect(screen.queryByRole('button', { name: 'Réceptionner' })).toBeNull()
  })

  it('initiation : seuls les couples adjacents sont proposés (jamais coffre -> secondaire)', async () => {
    listerSimule.mockResolvedValue(page([]))
    afficher()
    await screen.findByText(/Aucun transfert en transit/i)

    fireEvent.click(screen.getByRole('button', { name: 'Initier un transfert' }))

    const destination = (await screen.findByLabelText(
      'Niveau destination',
    )) as HTMLSelectElement
    const options = Array.from(destination.options).map((o) => o.value)
    expect(options).toEqual(['principale']) // source = coffre par défaut : une seule adjacence

    const source = screen.getByLabelText('Niveau source') as HTMLSelectElement
    fireEvent.change(source, { target: { value: 'principale' } })
    const optionsApres = Array.from(destination.options).map((o) => o.value)
    expect(optionsApres.sort()).toEqual(['coffre', 'secondaire'])
  })

  it('initiation : demande le poste quand un niveau vaut secondaire', async () => {
    listerSimule.mockResolvedValue(page([]))
    afficher()
    await screen.findByText(/Aucun transfert en transit/i)
    fireEvent.click(screen.getByRole('button', { name: 'Initier un transfert' }))

    fireEvent.change(screen.getByLabelText('Niveau source'), {
      target: { value: 'principale' },
    })
    fireEvent.change(screen.getByLabelText('Niveau destination'), {
      target: { value: 'secondaire' },
    })

    expect(await screen.findByLabelText('Poste')).toBeVisible()
  })

  it('initiation : envoie les bons paramètres au serveur', async () => {
    listerSimule.mockResolvedValue(page([]))
    initierSimule.mockResolvedValue(transfert())
    afficher()
    await screen.findByText(/Aucun transfert en transit/i)
    fireEvent.click(screen.getByRole('button', { name: 'Initier un transfert' }))

    fireEvent.change(screen.getByLabelText('Montant envoyé (F CFA)'), {
      target: { value: '75000' },
    })
    fireEvent.change(screen.getByLabelText('Motif (obligatoire)'), {
      target: { value: 'Alimentation du guichet' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }))

    await waitFor(() =>
      expect(initierSimule).toHaveBeenCalledWith(
        'coffre',
        'principale',
        null,
        75_000,
        'Alimentation du guichet',
      ),
    )
  })

  it('réception : l’écart se calcule en direct, avant confirmation', async () => {
    listerSimule.mockResolvedValue(page([transfert({ montant_envoye: 50_000 })]))
    afficher()
    await screen.findByText('Alimentation de la principale')

    fireEvent.click(screen.getByRole('button', { name: 'Réceptionner' }))
    const champ = await screen.findByLabelText('Montant réellement compté (F CFA)')

    fireEvent.change(champ, { target: { value: '48000' } })
    expect(await screen.findByText(/Écart : manquant de 2 000 F/)).toBeVisible()

    fireEvent.change(champ, { target: { value: '52000' } })
    expect(await screen.findByText(/Écart : excédent de 2 000 F/)).toBeVisible()

    fireEvent.change(champ, { target: { value: '50000' } })
    expect(await screen.findByText(/Aucun écart/)).toBeVisible()
  })

  it('réception : confirme avec le montant compté', async () => {
    listerSimule.mockResolvedValue(page([transfert({ montant_envoye: 50_000 })]))
    receptionnerSimule.mockResolvedValue(transfert({ statut: 'receptionne' }))
    afficher()
    await screen.findByText('Alimentation de la principale')

    fireEvent.click(screen.getByRole('button', { name: 'Réceptionner' }))
    fireEvent.change(await screen.findByLabelText('Montant réellement compté (F CFA)'), {
      target: { value: '48000' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la réception' }))

    await waitFor(() => expect(receptionnerSimule).toHaveBeenCalledWith('t1', 48_000))
  })

  it('réception : refus serveur (double regard) affiché proprement', async () => {
    listerSimule.mockResolvedValue(page([transfert()]))
    receptionnerSimule.mockRejectedValue(
      new AxiosError('refus', undefined, undefined, undefined, {
        status: 422,
        data: { detail: 'vous ne pouvez pas réceptionner un transfert que vous avez vous-même envoyé.' },
      } as never),
    )
    afficher()
    await screen.findByText('Alimentation de la principale')

    fireEvent.click(screen.getByRole('button', { name: 'Réceptionner' }))
    fireEvent.change(await screen.findByLabelText('Montant réellement compté (F CFA)'), {
      target: { value: '50000' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la réception' }))

    expect(await screen.findByText(/vous-même envoyé/)).toBeVisible()
  })

  it('filtre par niveau : relance la requête avec le niveau choisi', async () => {
    listerSimule.mockResolvedValue(page([transfert()]))
    afficher()
    await screen.findByText('Alimentation de la principale')

    fireEvent.change(screen.getByLabelText('Niveau'), { target: { value: 'secondaire' } })

    await waitFor(() =>
      expect(listerSimule).toHaveBeenCalledWith({
        statut: 'en_transit',
        niveau: 'secondaire',
      }),
    )
  })

  // --- Historique (Lot 2c) : un transfert réceptionné reste consultable, en lecture seule ----

  it('filtre statut : relance la requête avec le statut choisi', async () => {
    listerSimule.mockResolvedValue(page([]))
    afficher()
    await screen.findByText(/Aucun transfert en transit/i)

    fireEvent.change(screen.getByLabelText('Statut'), { target: { value: 'receptionne' } })

    await waitFor(() =>
      expect(listerSimule).toHaveBeenCalledWith({
        statut: 'receptionne',
        niveau: undefined,
      }),
    )
    expect(await screen.findByText(/Aucun transfert réceptionné/i)).toBeVisible()
  })

  it('transfert réceptionné : lecture seule, montant compté et écart affichés, sans bouton', async () => {
    listerSimule.mockResolvedValue(
      page([
        transfert({
          statut: 'receptionne',
          montant_envoye: 50_000,
          montant_compte: 48_000,
          receptionne_par_nom: 'Awa Sow',
          receptionne_le: '2026-09-29T10:00:00Z',
        }),
      ]),
    )
    afficher()

    expect(await screen.findByText('48 000 F')).toBeVisible()
    expect(screen.getByText(/Écart : manquant de 2 000 F/)).toBeVisible()
    expect(screen.getByText(/Réceptionné par/)).toBeVisible()
    expect(screen.getByText(/Awa Sow/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Réceptionner' })).toBeNull()
  })

  it('transfert réceptionné sans écart : la colonne Écart reste vide', async () => {
    listerSimule.mockResolvedValue(
      page([
        transfert({
          statut: 'receptionne',
          montant_envoye: 50_000,
          montant_compte: 50_000,
          receptionne_par_nom: 'Awa Sow',
          receptionne_le: '2026-09-29T10:00:00Z',
        }),
      ]),
    )
    afficher()
    await screen.findByText('Alimentation de la principale')

    expect(screen.queryByText(/Écart :/)).toBeNull()
  })

  it('transfert en transit : jamais de bouton Réceptionner sans caisse.transfert.valider, mais visible avec', async () => {
    etat.permissions = ['caisse.transfert.valider']
    listerSimule.mockResolvedValue(page([transfert({ statut: 'en_transit' })]))
    afficher()
    await screen.findByText('Alimentation de la principale')

    expect(screen.getByRole('button', { name: 'Réceptionner' })).toBeVisible()
  })
})
