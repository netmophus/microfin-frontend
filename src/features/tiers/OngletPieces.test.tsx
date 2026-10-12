import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ajouterPiece,
  ErreurDoublonPiece,
  ErreurPiece,
  listerPieces,
  listerTypesPieces,
  type Piece,
  type TypeDeFiche,
  type TypePiece,
} from '@/features/tiers/pieces'
import { OngletPieces } from '@/features/tiers/OngletPieces'

/**
 * Onglet Pièces — trois exigences d'écran :
 *  - la validité se voit d'un coup d'œil (badge périmée / valide) ;
 *  - « Vérifier » n'apparaît que pour qui a tiers.identity.verify ;
 *  - un doublon nommé (dans le périmètre) rend un LIEN vers la fiche existante.
 */

const etat = vi.hoisted(() => ({ permissions: ['tiers.update'] as string[] }))

vi.mock('@/features/auth/useProfil', () => ({
  useProfil: () => ({ data: { permissions: etat.permissions } }),
  useAPermission: (p: string) => etat.permissions.includes(p),
}))

vi.mock('@/features/tiers/pieces', async () => {
  const reel = await vi.importActual<typeof import('@/features/tiers/pieces')>('@/features/tiers/pieces')
  return {
    ...reel, // conserve ErreurDoublonPiece / ErreurPiece réelles
    listerPieces: vi.fn(),
    listerTypesPieces: vi.fn(),
    ajouterPiece: vi.fn(),
    definirPiecePrincipale: vi.fn(),
    verifierPiece: vi.fn(),
    supprimerPiece: vi.fn(),
  }
})
vi.mock('@/features/tiers/referentiels', () => ({ listerPays: vi.fn().mockResolvedValue([]) }))

const listerSimule = vi.mocked(listerPieces)
const typesSimule = vi.mocked(listerTypesPieces)
const ajoutSimule = vi.mocked(ajouterPiece)
const ID = '11111111-1111-1111-1111-111111111111'
const TYPE = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const TYPE_STATUTS = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

const CNI: TypePiece = {
  id: TYPE,
  code: 'CNI',
  name: 'Carte nationale',
  requires_expiry_date: true,
  requires_issuer: true,
  applies_to: ['individual'],
}
const STATUTS: TypePiece = {
  id: TYPE_STATUTS,
  code: 'STATUTS',
  name: 'Statuts',
  requires_expiry_date: false,
  requires_issuer: false,
  applies_to: ['legal_entity', 'group'],
}

const TYPE_RCCM = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
const RCCM: TypePiece = {
  id: TYPE_RCCM,
  code: 'RCCM',
  name: 'RCCM',
  requires_expiry_date: false,
  requires_issuer: true,
  applies_to: ['legal_entity'],
}

function piece(over: Partial<Piece>): Piece {
  return {
    id: 'p1',
    document_type_id: TYPE,
    document_number: 'NER-123',
    issuing_country_id: null,
    issuing_authority: null,
    date_of_issue: null,
    expiry_date: null,
    validite: 'valide',
    is_primary: true,
    is_verified: false,
    verified_at: null,
    verification_notes: null,
    notes: null,
    ...over,
  }
}

function afficher(tierType?: TypeDeFiche) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <OngletPieces tierId={ID} tierType={tierType} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.permissions = ['tiers.update']
  typesSimule.mockResolvedValue([CNI])
})

describe('OngletPieces', () => {
  it('la validité est visible d’un coup d’œil (badge)', async () => {
    listerSimule.mockResolvedValue([piece({ validite: 'perimee', expiry_date: '2020-01-01' })])

    afficher()

    expect(await screen.findByText('Périmée')).toBeVisible()
  })

  it('« Vérifier » n’apparaît qu’avec la permission tiers.identity.verify', async () => {
    listerSimule.mockResolvedValue([piece({ is_verified: false })])

    // Sans la permission : pas de bouton Vérifier.
    afficher()
    await screen.findByText('Carte nationale')
    expect(screen.queryByRole('button', { name: 'Vérifier' })).toBeNull()
  })

  it('avec tiers.identity.verify, « Vérifier » est proposé', async () => {
    etat.permissions = ['tiers.update', 'tiers.identity.verify']
    listerSimule.mockResolvedValue([piece({ is_verified: false })])

    afficher()

    expect(await screen.findByRole('button', { name: 'Vérifier' })).toBeVisible()
  })

  it('un doublon nommé rend un lien vers la fiche existante', async () => {
    listerSimule.mockResolvedValue([])
    ajoutSimule.mockRejectedValue(
      new ErreurDoublonPiece('Cette pièce est déjà enregistrée sur la fiche M-2026-42.', 'tid-42', 'M-2026-42', 'Traore'),
    )

    afficher()
    fireEvent.click(await screen.findByRole('button', { name: /Ajouter une pièce/ }))
    fireEvent.change(screen.getByLabelText('Type de pièce'), { target: { value: TYPE } })
    fireEvent.change(screen.getByLabelText('Numéro'), { target: { value: 'NER-123' } })
    fireEvent.change(screen.getByLabelText(/Autorité de délivrance/), { target: { value: 'Préfecture' } })
    fireEvent.change(screen.getByLabelText(/Date d’expiration/), { target: { value: '2035-01-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))

    const lien = await screen.findByRole('link', { name: /Voir la fiche/ })
    expect(lien).toHaveAttribute('href', '/tiers/tid-42')
  })

  it('le sélecteur ne demande que les types applicables à ce type de fiche', async () => {
    listerSimule.mockResolvedValue([])
    typesSimule.mockResolvedValue([STATUTS])

    afficher('legal_entity')
    fireEvent.click(await screen.findByRole('button', { name: /Ajouter une pièce/ }))

    expect(typesSimule).toHaveBeenCalledWith('legal_entity')
    const options = within(screen.getByLabelText('Type de pièce')).getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual(['Choisir…', 'Statuts'])
  })

  it('un type qui exige l’autorité et l’échéance bloque l’ajout tant qu’elles manquent', async () => {
    listerSimule.mockResolvedValue([])
    ajoutSimule.mockResolvedValue(piece({}))

    afficher('individual')
    fireEvent.click(await screen.findByRole('button', { name: /Ajouter une pièce/ }))
    fireEvent.change(screen.getByLabelText('Type de pièce'), { target: { value: TYPE } })
    fireEvent.change(screen.getByLabelText('Numéro'), { target: { value: 'NER-1' } })

    const ajouter = screen.getByRole('button', { name: 'Ajouter' })
    expect(screen.getByLabelText('Autorité de délivrance (obligatoire)')).toBeRequired()
    expect(screen.getByLabelText('Date d’expiration (obligatoire)')).toBeRequired()
    expect(ajouter).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/Autorité de délivrance/), { target: { value: 'Préfecture' } })
    expect(ajouter).toBeDisabled() // l'échéance manque encore
    fireEvent.change(screen.getByLabelText(/Date d’expiration/), { target: { value: '2035-01-01' } })
    expect(ajouter).toBeEnabled()
  })

  it('un type sans exigence laisse l’autorité facultative et masque l’échéance', async () => {
    listerSimule.mockResolvedValue([])
    typesSimule.mockResolvedValue([STATUTS])

    afficher('legal_entity')
    fireEvent.click(await screen.findByRole('button', { name: /Ajouter une pièce/ }))
    fireEvent.change(screen.getByLabelText('Type de pièce'), { target: { value: TYPE_STATUTS } })
    fireEvent.change(screen.getByLabelText('Numéro'), { target: { value: 'S-1' } })

    expect(screen.getByLabelText('Autorité de délivrance (facultatif)')).not.toBeRequired()
    expect(screen.queryByLabelText(/Date d’expiration/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeEnabled()
  })

  it('RCCM : l’échéance est masquée et l’autorité devient obligatoire', async () => {
    listerSimule.mockResolvedValue([])
    typesSimule.mockResolvedValue([RCCM])

    afficher('legal_entity')
    fireEvent.click(await screen.findByRole('button', { name: /Ajouter une pièce/ }))
    fireEvent.change(screen.getByLabelText('Type de pièce'), { target: { value: TYPE_RCCM } })
    fireEvent.change(screen.getByLabelText('Numéro'), { target: { value: 'NE-NIA-2024-B-1157' } })

    expect(screen.queryByLabelText(/Date d’expiration/)).toBeNull()
    expect(screen.getByLabelText('Autorité de délivrance (obligatoire)')).toBeRequired()
    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeDisabled()
    expect(screen.getByLabelText('Numéro')).toHaveAttribute('placeholder', 'Ex. NE-NIA-2024-B-1157')
  })

  it('CNI : l’échéance est affichée et obligatoire', async () => {
    listerSimule.mockResolvedValue([])

    afficher('individual')
    fireEvent.click(await screen.findByRole('button', { name: /Ajouter une pièce/ }))
    fireEvent.change(screen.getByLabelText('Type de pièce'), { target: { value: TYPE } })

    expect(screen.getByLabelText('Date d’expiration (obligatoire)')).toBeRequired()
    expect(screen.getByLabelText('Numéro')).toHaveAttribute('placeholder', 'Tel qu’il figure sur la pièce')
  })

  it('RCCM → CNI → STATUTS : l’échéance saisie est vidée, puis réaffichée vide', async () => {
    listerSimule.mockResolvedValue([])
    typesSimule.mockResolvedValue([RCCM, CNI, STATUTS])

    afficher('legal_entity')
    fireEvent.click(await screen.findByRole('button', { name: /Ajouter une pièce/ }))
    const type = screen.getByLabelText('Type de pièce')

    fireEvent.change(type, { target: { value: TYPE_RCCM } })
    expect(screen.queryByLabelText(/Date d’expiration/)).toBeNull()

    fireEvent.change(type, { target: { value: TYPE } })
    fireEvent.change(screen.getByLabelText(/Date d’expiration/), { target: { value: '2035-01-01' } })
    expect(screen.getByLabelText(/Date d’expiration/)).toHaveValue('2035-01-01')

    fireEvent.change(type, { target: { value: TYPE_STATUTS } })
    expect(screen.queryByLabelText(/Date d’expiration/)).toBeNull()
    expect(screen.getByLabelText('Numéro')).toHaveAttribute('placeholder', 'Référence ou date de l’acte')

    fireEvent.change(type, { target: { value: TYPE } })
    expect(screen.getByLabelText(/Date d’expiration/)).toHaveValue('')
  })

  it('le libellé de la date suit le type de fiche', async () => {
    listerSimule.mockResolvedValue([])

    afficher('individual')
    fireEvent.click(await screen.findByRole('button', { name: /Ajouter une pièce/ }))
    expect(screen.getByLabelText('Date de délivrance (facultatif)')).toBeVisible()
  })

  it('PM : la date s’appelle « Date d’établissement »', async () => {
    listerSimule.mockResolvedValue([])
    typesSimule.mockResolvedValue([STATUTS])

    afficher('legal_entity')
    fireEvent.click(await screen.findByRole('button', { name: /Ajouter une pièce/ }))
    expect(screen.getByLabelText('Date d’établissement (facultatif)')).toBeVisible()
  })

  it('un refus métier du serveur s’affiche tel quel', async () => {
    listerSimule.mockResolvedValue([])
    ajoutSimule.mockRejectedValue(new ErreurPiece('Ce type de pièce ne s’applique pas à ce type de fiche.'))

    afficher('individual')
    fireEvent.click(await screen.findByRole('button', { name: /Ajouter une pièce/ }))
    fireEvent.change(screen.getByLabelText('Type de pièce'), { target: { value: TYPE } })
    fireEvent.change(screen.getByLabelText('Numéro'), { target: { value: 'NER-1' } })
    fireEvent.change(screen.getByLabelText(/Autorité de délivrance/), { target: { value: 'Préfecture' } })
    fireEvent.change(screen.getByLabelText(/Date d’expiration/), { target: { value: '2035-01-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ce type de pièce ne s’applique pas à ce type de fiche.',
    )
  })
})
