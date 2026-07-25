import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ajouterPiece,
  ErreurDoublonPiece,
  listerPieces,
  listerTypesPieces,
  type Piece,
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

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <OngletPieces tierId={ID} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.permissions = ['tiers.update']
  typesSimule.mockResolvedValue([{ id: TYPE, code: 'CNI', name: 'Carte nationale', requires_expiry_date: true }])
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
    expect(screen.queryByText('Vérifier')).toBeNull()
  })

  it('avec tiers.identity.verify, « Vérifier » est proposé', async () => {
    etat.permissions = ['tiers.update', 'tiers.identity.verify']
    listerSimule.mockResolvedValue([piece({ is_verified: false })])

    afficher()

    expect(await screen.findByText('Vérifier')).toBeVisible()
  })

  it('un doublon nommé rend un lien vers la fiche existante', async () => {
    listerSimule.mockResolvedValue([])
    ajoutSimule.mockRejectedValue(
      new ErreurDoublonPiece('Cette pièce est déjà enregistrée sur la fiche M-2026-42.', 'tid-42', 'M-2026-42', 'Traore'),
    )

    afficher()
    fireEvent.click(await screen.findByText('+ Ajouter une pièce'))
    fireEvent.change(screen.getByLabelText('Type de pièce'), { target: { value: TYPE } })
    fireEvent.change(screen.getByLabelText('Numéro'), { target: { value: 'NER-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))

    const lien = await screen.findByRole('link', { name: /Voir la fiche/ })
    expect(lien).toHaveAttribute('href', '/tiers/tid-42')
  })
})
