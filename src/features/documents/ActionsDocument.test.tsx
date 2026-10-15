import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ActionsDocument } from '@/features/documents/ActionsDocument'
import { ouvrirPdf, regenererDocument, telechargerDocument, type DocumentRef } from '@/features/documents/api'

/**
 * Actions sur le document d'une opération réussie : le PDF du serveur est récupéré puis ouvert ;
 * sans référence ou sans droit de lecture, seul un message le dit (le PDF du serveur est la seule pièce).
 */

const etat = vi.hoisted(() => ({ permissions: [] as string[] }))

vi.mock('@/features/auth/useProfil', () => ({
  useAPermission: (p: string) => etat.permissions.includes(p),
}))

vi.mock('@/features/documents/api', () => ({
  telechargerDocument: vi.fn(),
  regenererDocument: vi.fn(),
  ouvrirPdf: vi.fn(),
}))

const telechargerSimule = vi.mocked(telechargerDocument)
const regenererSimule = vi.mocked(regenererDocument)
const ouvrirSimule = vi.mocked(ouvrirPdf)

const uneRef = (o: Partial<DocumentRef> = {}): DocumentRef => ({
  id: 'd1',
  nom: 'recu_versement_EP-1_CA-1.pdf',
  statut: 'ok',
  ...o,
})

function afficher(
  reference: DocumentRef | null | undefined,
  objet: 'recu' | 'bon' | 'lettre' | 'arrete' = 'recu',
) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ActionsDocument reference={reference} objet={objet} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.permissions = ['documents.read']
})

describe('ActionsDocument', () => {
  it('référence ok : le bouton récupère le PDF puis l’ouvre', async () => {
    const pdf = new Blob(['%PDF'])
    telechargerSimule.mockResolvedValue(pdf)
    afficher(uneRef())

    fireEvent.click(screen.getByRole('button', { name: 'Télécharger / Imprimer le reçu' }))

    await waitFor(() => expect(ouvrirSimule).toHaveBeenCalledWith(pdf, 'recu_versement_EP-1_CA-1.pdf'))
    expect(telechargerSimule).toHaveBeenCalledWith('d1')
  })

  it('le bon porte son propre libellé', () => {
    afficher(uneRef({ nom: 'bon_dat_DAT-1.pdf' }), 'bon')

    expect(screen.getByRole('button', { name: 'Télécharger / Imprimer le bon' })).toBeVisible()
  })

  it('la lettre a son propre libellé', () => {
    afficher(uneRef({ nom: 'lettre.pdf' }), 'lettre')

    expect(screen.getByRole('button', { name: 'Télécharger la lettre' })).toBeVisible()
  })

  it('l’arrêté de caisse a son propre libellé', () => {
    afficher(uneRef({ nom: 'arrete_caisse_101111.pdf' }), 'arrete')

    expect(screen.getByRole('button', { name: 'Télécharger l’arrêté' })).toBeVisible()
  })

  it('échec d’ouverture : message affiché, rien n’est ouvert', async () => {
    telechargerSimule.mockRejectedValue(new Error('réseau'))
    afficher(uneRef())

    fireEvent.click(screen.getByRole('button', { name: 'Télécharger / Imprimer le reçu' }))

    expect(await screen.findByRole('alert')).toBeVisible()
    expect(ouvrirSimule).not.toHaveBeenCalled()
  })

  it('référence en échec : message, « Régénérer », puis le bouton de téléchargement', async () => {
    regenererSimule.mockResolvedValue(uneRef())
    afficher(uneRef({ statut: 'echec' }))

    expect(screen.getByRole('status')).toBeVisible()
    expect(screen.queryByRole('button', { name: /Télécharger/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Régénérer' }))

    expect(await screen.findByRole('button', { name: 'Télécharger / Imprimer le reçu' })).toBeVisible()
    expect(regenererSimule).toHaveBeenCalledWith('d1')
  })

  it('régénération refusée : message d’erreur, le bouton Régénérer reste', async () => {
    regenererSimule.mockRejectedValue(new Error('disque plein'))
    afficher(uneRef({ statut: 'echec' }))

    fireEvent.click(screen.getByRole('button', { name: 'Régénérer' }))

    expect(await screen.findByRole('alert')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Régénérer' })).toBeVisible()
  })

  it('référence absente : un message, aucun bouton, aucun appel serveur', () => {
    afficher(null)

    expect(screen.getByRole('status')).toBeVisible()
    expect(screen.queryByRole('button', { name: /Télécharger|Régénérer/ })).toBeNull()
    expect(telechargerSimule).not.toHaveBeenCalled()
  })

  it('sans documents.read : pas de bouton PDF ni de Régénérer, un message', () => {
    etat.permissions = []
    afficher(uneRef({ statut: 'echec' }))

    expect(screen.queryByRole('button', { name: /Télécharger|Régénérer/ })).toBeNull()
    expect(screen.getByRole('status')).toBeVisible()
  })
})
