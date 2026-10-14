import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  chargerParts,
  libererParts,
  listerTiers,
  souscrireComptant,
  type FichePartsSociales,
} from '@/features/tiers/api'
import { OngletGuichetParts } from '@/features/tiers/OngletGuichetParts'

/**
 * Onglet Parts sociales du guichet — l'encaissement du caissier. Points durs : le NOM est
 * proéminent avant toute opération (vérification humaine), le gate KYC bloque un tiers non
 * actif, la confirmation RÉPÈTE le nom et le montant (comme le guichet épargne), et un nouveau
 * client peut devenir sociétaire EN UNE VISITE (souscription au comptant).
 */

vi.mock('@/features/auth/useProfil', () => ({
  useProfil: () => ({
    data: {
      username: 'caissier1',
      last_name: 'Souley',
      first_name: 'Awa',
      agence_courante: { id: 'a1', code: 'AG-001', name: 'Siège' },
      institution: { nom: 'IMCEC Test', adresse: '', telephone: '', numero_agrement: '' },
    },
  }),
}))

vi.mock('@/features/tiers/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/tiers/api')>('@/features/tiers/api')
  return {
    ...reel,
    listerTiers: vi.fn(),
    chargerParts: vi.fn(),
    souscrireComptant: vi.fn(),
    libererParts: vi.fn(),
  }
})

const rechercheSimule = vi.mocked(listerTiers)
const partsSimule = vi.mocked(chargerParts)
const comptantSimule = vi.mocked(souscrireComptant)
const libererSimule = vi.mocked(libererParts)

function ligne(o: Partial<{ id: string; tier_number: string; display_name: string; status: string; is_member: boolean }> = {}) {
  return {
    id: 't1',
    tier_number: 'M-2026-0000005',
    tier_type: 'individual',
    display_name: 'Traoré Fatoumata',
    status: 'actif',
    is_member: false,
    primary_agency_id: 'a1',
    ...o,
  }
}

function parts(o: Partial<FichePartsSociales> = {}): FichePartsSociales {
  return {
    is_member: false,
    shares_liberees: 0,
    shares_non_liberees: 0,
    capital_libere: 0,
    capital_non_libere: 0,
    unit_value: 5000,
    minimum_shares: 1,
    is_refundable: true,
    membership_on: 'liberation',
    is_provisional: true,
    mouvements: [],
    ...o,
  }
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <OngletGuichetParts />
    </QueryClientProvider>,
  )
}

async function chercherEtSelectionner(resultat = ligne()) {
  rechercheSimule.mockResolvedValue({ lignes: [resultat], total: 1, page: 1, taille: 25 })
  fireEvent.change(screen.getByLabelText('Numéro ou nom'), { target: { value: 'Traoré' } })
  fireEvent.click(screen.getByRole('button', { name: /Chercher/ }))
  fireEvent.click(await screen.findByRole('button', { name: /Traoré Fatoumata/ }))
}

beforeEach(() => vi.clearAllMocks())

describe('OngletGuichetParts', () => {
  it('recherche sans résultat : message clair', async () => {
    rechercheSimule.mockResolvedValue({ lignes: [], total: 0, page: 1, taille: 25 })
    afficher()
    fireEvent.change(screen.getByLabelText('Numéro ou nom'), { target: { value: 'Personne' } })
    fireEvent.click(screen.getByRole('button', { name: /Chercher/ }))

    expect(await screen.findByText(/Aucun tiers ne correspond/)).toBeVisible()
  })

  it('sélection : le NOM est proéminent, badge Client', async () => {
    partsSimule.mockResolvedValue(parts())
    afficher()
    await chercherEtSelectionner()

    expect(await screen.findByText('Traoré Fatoumata')).toBeVisible()
    expect(screen.getByText('M-2026-0000005')).toBeVisible()
    expect(screen.getByText('Client')).toBeVisible()
  })

  it('tiers non actif : le gate est expliqué, aucune action offerte', async () => {
    partsSimule.mockResolvedValue(parts())
    afficher()
    await chercherEtSelectionner(ligne({ status: 'prospect' }))

    expect(await screen.findByText(/doit être actif/)).toBeVisible()
    expect(screen.queryByRole('button', { name: /Souscrire au comptant/ })).toBeNull()
  })

  it('un nouveau client devient sociétaire EN UNE VISITE (comptant), badge bascule', async () => {
    partsSimule.mockResolvedValueOnce(parts({ is_member: false }))
    comptantSimule.mockResolvedValue({
      is_member: true,
      shares_liberees: 10,
      shares_non_liberees: 0,
      entry_number: 'CA-2026-000042',
      date_comptable: '2026-10-14',
    })
    partsSimule.mockResolvedValueOnce(parts({ is_member: true, shares_liberees: 10, capital_libere: 50000 }))
    afficher()
    await chercherEtSelectionner()

    fireEvent.click(await screen.findByRole('button', { name: /Souscrire au comptant/ }))
    fireEvent.change(screen.getByLabelText('Nombre de parts'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))

    // La confirmation RÉPÈTE le nom et le montant — comme au guichet épargne.
    expect(
      await screen.findByText(/Encaisser 50 000 F et faire adhérer Traoré Fatoumata \(10 parts\)/),
    ).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))

    await waitFor(() => expect(comptantSimule).toHaveBeenCalledWith('t1', 10))
    expect(await screen.findByText(/désormais MEMBRE/)).toBeVisible()
    // Le badge reflète la nouvelle situation après invalidation.
    // Le 1er « Membre » du DOM est le badge ; le reçu (masqué à l'écran) a aussi un libellé « Membre ».
    await waitFor(() => expect(screen.getAllByText('Membre')[0]).toBeVisible())
  })

  it('libérer n’apparaît que s’il y a des parts non libérées, confirmation répète le nom', async () => {
    partsSimule.mockResolvedValue(parts({ shares_non_liberees: 4, unit_value: 5000 }))
    libererSimule.mockResolvedValue({
      is_member: true,
      shares_liberees: 4,
      shares_non_liberees: 0,
      entry_number: 'CA-2026-000099',
      date_comptable: '2026-10-14',
    })
    afficher()
    await chercherEtSelectionner()

    fireEvent.click(await screen.findByRole('button', { name: /Libérer des parts/ }))
    fireEvent.change(screen.getByLabelText('Nombre de parts'), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))

    expect(
      await screen.findByText(/Encaisser 20 000 F pour libérer 4 parts de Traoré Fatoumata/),
    ).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
    await waitFor(() => expect(libererSimule).toHaveBeenCalledWith('t1', 4))
  })

  it('refus serveur : message en langage humain affiché tel quel', async () => {
    partsSimule.mockResolvedValue(parts())
    comptantSimule.mockRejectedValue(
      new AxiosError('rejet', undefined, undefined, undefined, {
        status: 422,
        data: { detail: 'La valeur d’une part n’est pas encore fixée.' },
      } as never),
    )
    afficher()
    await chercherEtSelectionner()

    fireEvent.click(await screen.findByRole('button', { name: /Souscrire au comptant/ }))
    fireEvent.change(screen.getByLabelText('Nombre de parts'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))

    expect(await screen.findByText('La valeur d’une part n’est pas encore fixée.')).toBeVisible()
  })
})

describe('OngletGuichetParts — reçu imprimable', () => {
  const zone = (conteneur: HTMLElement) =>
    conteneur.querySelector('[data-document="recu"]') as HTMLElement
  const texteDe = (element: HTMLElement) => element.innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

  beforeEach(() => {
    vi.spyOn(window, 'print').mockImplementation(() => undefined)
  })

  afterEach(() => vi.restoreAllMocks())

  it('souscription au comptant : reçu avec parts, valeur, montant en lettres, date comptable', async () => {
    partsSimule.mockResolvedValue(parts({ is_member: false }))
    comptantSimule.mockResolvedValue({
      is_member: true,
      shares_liberees: 10,
      shares_non_liberees: 0,
      entry_number: 'CA-2026-000042',
      date_comptable: '2026-10-14',
    })
    afficher()
    await chercherEtSelectionner()
    expect(screen.queryByRole('button', { name: 'Imprimer le reçu' })).toBeNull()

    fireEvent.click(await screen.findByRole('button', { name: /Souscrire au comptant/ }))
    fireEvent.change(screen.getByLabelText('Nombre de parts'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmer' }))

    fireEvent.click(await screen.findByRole('button', { name: 'Imprimer le reçu' }))
    expect(window.print).toHaveBeenCalledTimes(1)
    const recu = zone(document.body)
    expect(recu).toHaveClass('zone-impression', 'hidden', 'print:block')
    const texte = texteDe(recu)
    expect(texte).toContain('Reçu de souscription de parts sociales (au comptant)')
    expect(texte).toContain('Reçu n° CA-2026-000042')
    expect(texte).toContain('Journée comptable : 14/10/2026')
    expect(texte).toContain('Souley Awa')
    expect(texte).toContain('Traoré Fatoumata')
    expect(texte).toContain('Parts sociales — M-2026-0000005')
    expect(texte).toContain('Nombre de parts 10')
    expect(texte).toContain('Valeur d’une part 5 000 F')
    expect(texte).toContain('50 000 F')
    expect(texte).toContain('cinquante mille francs CFA')
    expect(texte).toContain('Signature du client (facultative)')
  })

  it('libération : reçu intitulé « libération »', async () => {
    partsSimule.mockResolvedValue(parts({ shares_non_liberees: 4, unit_value: 5000 }))
    libererSimule.mockResolvedValue({
      is_member: true,
      shares_liberees: 4,
      shares_non_liberees: 0,
      entry_number: 'CA-2026-000099',
      date_comptable: '2026-10-14',
    })
    afficher()
    await chercherEtSelectionner()

    fireEvent.click(await screen.findByRole('button', { name: /Libérer des parts/ }))
    fireEvent.change(screen.getByLabelText('Nombre de parts'), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmer' }))

    await screen.findByRole('button', { name: 'Imprimer le reçu' })
    const texte = texteDe(zone(document.body))
    expect(texte).toContain('Reçu de libération de parts sociales')
    expect(texte).toContain('Reçu n° CA-2026-000099')
    expect(texte).toContain('20 000 F')
    expect(texte).toContain('vingt mille francs CFA')
  })

  it('un refus du serveur ne produit ni bouton ni document', async () => {
    partsSimule.mockResolvedValue(parts({ is_member: false }))
    comptantSimule.mockRejectedValue(
      new AxiosError('rejet', undefined, undefined, undefined, {
        status: 422,
        data: { detail: 'Aucune session de caisse ouverte pour vous.' },
      } as never),
    )
    afficher()
    await chercherEtSelectionner()

    fireEvent.click(await screen.findByRole('button', { name: /Souscrire au comptant/ }))
    fireEvent.change(screen.getByLabelText('Nombre de parts'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmer' }))

    expect(await screen.findByText('Aucune session de caisse ouverte pour vous.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Imprimer le reçu' })).toBeNull()
    expect(zone(document.body)).toBeNull()
  })
})
