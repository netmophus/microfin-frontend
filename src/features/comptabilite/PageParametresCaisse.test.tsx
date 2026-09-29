import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  lireParametresCaisse,
  modifierParametresCaisse,
  type ParametresCaisse,
} from '@/features/caisse/api'
import { listerComptesSelecteur, type CompteSelecteur } from '@/features/comptabilite/api'
import { PageParametresCaisse } from '@/features/comptabilite/PageParametresCaisse'

/**
 * Seuil de tolérance de caisse (CA2) + rattachement de l'écart (CA3), Bloc 5. Points durs :
 * motif obligatoire à la modification, une config absente (404) affiche un message humain
 * plutôt qu'un écran cassé, « Modifier » n'apparaît qu'avec compta.plan.manage, un
 * rattachement incomplet affiche un avertissement explicite (la validation sera refusée),
 * jamais silencieux.
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

vi.mock('@/features/comptabilite/api', async () => {
  const reel =
    await vi.importActual<typeof import('@/features/comptabilite/api')>(
      '@/features/comptabilite/api',
    )
  return { ...reel, listerComptesSelecteur: vi.fn() }
})

const lireSimule = vi.mocked(lireParametresCaisse)
const modifierSimule = vi.mocked(modifierParametresCaisse)
const listerComptesSimule = vi.mocked(listerComptesSelecteur)

function config(partiel: Partial<ParametresCaisse> = {}): ParametresCaisse {
  return {
    seuil_tolerance: 500,
    compte_ecart_manquant: { account_number: '6099', name: 'Diverses charges financières' },
    compte_ecart_excedent: { account_number: '7099', name: 'Divers produits' },
    compte_transit: null,
    compte_ecart_transfert_manquant: null,
    compte_ecart_transfert_excedent: null,
    is_provisional: true,
    ...partiel,
  }
}

const comptesSelecteur: CompteSelecteur[] = [
  { id: 'c1', account_number: '6099', name: 'Diverses charges financières' },
  { id: 'c2', account_number: '7099', name: 'Divers produits' },
  { id: 'c3', account_number: '1141', name: 'Banques et correspondants' },
]

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
  listerComptesSimule.mockResolvedValue(comptesSelecteur)
})

describe('PageParametresCaisse', () => {
  it('affiche le seuil, les comptes rattachés et le badge provisoire', async () => {
    lireSimule.mockResolvedValue(config())
    afficher()

    expect(await screen.findByText('500 F')).toBeVisible()
    expect(screen.getByText('6099 — Diverses charges financières')).toBeVisible()
    expect(screen.getByText('7099 — Divers produits')).toBeVisible()
    expect(screen.getByText('provisoire')).toBeVisible()
  })

  it('rattachement incomplet : avertit que la validation sera refusée', async () => {
    lireSimule.mockResolvedValue(config({ compte_ecart_manquant: null }))
    afficher()

    expect(
      await screen.findByText(/la validation d.un écart par le responsable sera refusée/),
    ).toBeVisible()
  })

  it('rattachement complet : aucun avertissement', async () => {
    lireSimule.mockResolvedValue(config())
    afficher()
    await screen.findByText('500 F')

    expect(
      screen.queryByText(/la validation d.un écart par le responsable sera refusée/),
    ).toBeNull()
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

  it('édition : motif obligatoire, enregistre le seuil et les deux comptes', async () => {
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
      expect(modifierSimule).toHaveBeenCalledWith(
        1000,
        '6099',
        '7099',
        null,
        null,
        null,
        'Révision institutionnelle',
      ),
    )
  })

  it('édition : vider un compte le soumet comme non rattaché (null)', async () => {
    lireSimule.mockResolvedValue(config())
    modifierSimule.mockResolvedValue(config({ compte_ecart_manquant: null }))
    afficher()
    await screen.findByText('500 F')

    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    await screen.findByRole('button', { name: 'Enregistrer' })

    const champManquant = screen.getByLabelText('Compte de l’écart — manquant')
    fireEvent.change(champManquant, { target: { value: '' } })
    fireEvent.blur(champManquant)
    fireEvent.change(screen.getByLabelText('Motif (obligatoire)'), {
      target: { value: 'Retrait temporaire du rattachement' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() =>
      expect(modifierSimule).toHaveBeenCalledWith(
        500,
        null,
        '7099',
        null,
        null,
        null,
        'Retrait temporaire du rattachement',
      ),
    )
  })

  it('affiche les 3 comptes de transfert, « non rattaché » tant que non paramétrés', async () => {
    lireSimule.mockResolvedValue(config())
    afficher()

    expect(await screen.findByText('Compte de liaison des transferts')).toBeVisible()
    // Les 3 champs transfert sont non rattachés dans `config()` par défaut.
    expect(screen.getAllByText('— non rattaché —').length).toBeGreaterThanOrEqual(3)
  })

  it('compte de liaison non paramétré : avertit qu’aucun transfert ne pourra être initié', async () => {
    lireSimule.mockResolvedValue(config())
    afficher()

    expect(
      await screen.findByText(/aucun transfert de caisse ne pourra être initié/),
    ).toBeVisible()
  })

  it('compte de liaison paramétré : aucun avertissement transferts', async () => {
    lireSimule.mockResolvedValue(
      config({ compte_transit: { account_number: '1141', name: 'Banques et correspondants' } }),
    )
    afficher()
    await screen.findByText('500 F')

    expect(
      screen.queryByText(/aucun transfert de caisse ne pourra être initié/),
    ).toBeNull()
  })

  it('édition : saisit les 3 comptes de transfert et les envoie au serveur', async () => {
    lireSimule.mockResolvedValue(config())
    modifierSimule.mockResolvedValue(
      config({ compte_transit: { account_number: '1141', name: 'Banques et correspondants' } }),
    )
    afficher()
    await screen.findByText('500 F')

    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    await screen.findByRole('button', { name: 'Enregistrer' })

    const champTransit = screen.getByLabelText('Compte de liaison des transferts')
    fireEvent.change(champTransit, { target: { value: '1141' } })
    fireEvent.blur(champTransit)
    const champEcartManquant = screen.getByLabelText('Écart de transfert — manquant')
    fireEvent.change(champEcartManquant, { target: { value: '6099' } })
    fireEvent.blur(champEcartManquant)
    const champEcartExcedent = screen.getByLabelText('Écart de transfert — excédent')
    fireEvent.change(champEcartExcedent, { target: { value: '7099' } })
    fireEvent.blur(champEcartExcedent)
    fireEvent.change(screen.getByLabelText('Motif (obligatoire)'), {
      target: { value: 'Paramétrage des transferts' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() =>
      expect(modifierSimule).toHaveBeenCalledWith(
        500,
        '6099',
        '7099',
        '1141',
        '6099',
        '7099',
        'Paramétrage des transferts',
      ),
    )
  })
})
