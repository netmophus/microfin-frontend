import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  listerDocuments,
  ouvrirPdf,
  regenererDocument,
  telechargerBrouillon,
  telechargerDocument,
  type DocumentResume,
  type PageDocuments as PageDocumentsApi,
} from '@/features/documents/api'
import { ErreurServeurDocument } from '@/features/documents/erreurs'
import { PageDocuments } from '@/features/documents/PageDocuments'

/**
 * « Documents du jour ». Points durs : les quatre états (chargement, vide, erreur, partiel), les
 * filtres journée / module / type et la pagination sont envoyés AU SERVEUR (jamais filtrés ici),
 * téléchargement et régénération par ligne, brouillons réservés à compta.rapport.read.
 */

const etat = vi.hoisted(() => ({ permissions: ['documents.read'] as string[] }))

vi.mock('@/features/auth/useProfil', () => ({
  useAPermission: (p: string) => etat.permissions.includes(p),
}))

vi.mock('@/features/documents/api', () => ({
  listerDocuments: vi.fn(),
  telechargerDocument: vi.fn(),
  telechargerBrouillon: vi.fn(),
  regenererDocument: vi.fn(),
  ouvrirPdf: vi.fn(),
}))

const listeSimulee = vi.mocked(listerDocuments)
const telechargerSimule = vi.mocked(telechargerDocument)
const brouillonSimule = vi.mocked(telechargerBrouillon)
const regenererSimule = vi.mocked(regenererDocument)
const ouvrirSimule = vi.mocked(ouvrirPdf)

const unDocument = (o: Partial<DocumentResume> = {}): DocumentResume => ({
  id: 'd1',
  type: 'recu_versement',
  module: 'caisse',
  journee_comptable: '2026-10-14',
  nom_fichier: 'recu_versement_EP-1_CA-1.pdf',
  numero_piece: 'CA-2026-000001',
  statut: 'ok',
  erreur: null,
  ...o,
})

const unePage = (lignes: DocumentResume[], total = lignes.length): PageDocumentsApi => ({
  lignes,
  total,
  page: 1,
  taille: 25,
})

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PageDocuments />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.permissions = ['documents.read']
})

describe('PageDocuments', () => {
  it('chargement : un squelette de la table, pas un rond qui tourne', () => {
    listeSimulee.mockReturnValue(new Promise(() => undefined))
    afficher()

    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('columnheader', { name: 'Document' })).toBeVisible()
  })

  it('liste : libellés métier, journée comptable, pièce — jamais le code brut du type', async () => {
    listeSimulee.mockResolvedValue(unePage([unDocument()]))
    afficher()

    expect(await screen.findByRole('cell', { name: 'Reçu de versement' })).toBeVisible()
    expect(screen.getByRole('cell', { name: 'Caisse' })).toBeVisible()
    expect(screen.getByText('14/10/2026')).toBeVisible()
    expect(screen.getByText('CA-2026-000001')).toBeVisible()
    expect(screen.queryByText('recu_versement')).toBeNull()
    expect(listeSimulee).toHaveBeenCalledWith({}, 1, 25)
  })

  it('type inconnu : un libellé neutre, jamais le code', async () => {
    listeSimulee.mockResolvedValue(unePage([unDocument({ type: 'type_futur_x' })]))
    afficher()

    expect(await screen.findByRole('cell', { name: 'Autre document' })).toBeVisible()
    expect(screen.queryByText('type_futur_x')).toBeNull()
  })

  it('vide sans filtre : dit ce qui manque et ce qui remplira l’écran', async () => {
    listeSimulee.mockResolvedValue(unePage([]))
    afficher()

    expect(await screen.findByText(/Aucun document archivé pour l’instant/)).toBeVisible()
  })

  it('vide avec filtre : propose de réinitialiser', async () => {
    listeSimulee.mockResolvedValue(unePage([unDocument()]))
    afficher()
    await screen.findByRole('cell', { name: 'Reçu de versement' })
    listeSimulee.mockResolvedValue(unePage([]))

    fireEvent.change(screen.getByLabelText('Module'), { target: { value: 'tiers' } })

    expect(await screen.findByText(/Aucun document ne correspond à ces filtres/)).toBeVisible()
    listeSimulee.mockResolvedValue(unePage([unDocument()]))
    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser les filtres' }))
    expect(await screen.findByRole('cell', { name: 'Reçu de versement' })).toBeVisible()
  })

  it('erreur : message en langage métier et « Réessayer »', async () => {
    listeSimulee.mockRejectedValue(new Error('réseau'))
    afficher()

    expect(await screen.findByText('Impossible de charger les documents.')).toBeVisible()
    listeSimulee.mockResolvedValue(unePage([unDocument()]))
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByRole('cell', { name: 'Reçu de versement' })).toBeVisible()
  })

  it('partiel : un bandeau signale les documents en échec et la ligne propose « Régénérer »', async () => {
    listeSimulee.mockResolvedValue(
      unePage([unDocument(), unDocument({ id: 'd2', statut: 'echec', nom_fichier: 'x.pdf' })]),
    )
    afficher()

    expect(await screen.findByText(/1 document\(s\) de cette page n’ont pas pu être générés/)).toBeVisible()
    expect(screen.getByText('Échec de génération')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Régénérer' })).toBeVisible()
  })

  it('les filtres sont envoyés au serveur et ramènent à la page 1', async () => {
    listeSimulee.mockResolvedValue(unePage([unDocument()], 60))
    afficher()
    await screen.findByRole('cell', { name: 'Reçu de versement' })
    fireEvent.click(screen.getByRole('button', { name: 'Suivante' }))
    await waitFor(() => expect(listeSimulee).toHaveBeenLastCalledWith({}, 2, 25))

    fireEvent.change(screen.getByLabelText('Journée comptable'), { target: { value: '2026-10-14' } })
    await waitFor(() => expect(listeSimulee).toHaveBeenLastCalledWith({ journee: '2026-10-14' }, 1, 25))
    fireEvent.change(screen.getByLabelText('Type de document'), { target: { value: 'bon_dat' } })
    await waitFor(() =>
      expect(listeSimulee).toHaveBeenLastCalledWith({ journee: '2026-10-14', type: 'bon_dat' }, 1, 25),
    )
  })

  it('le filtre de type propose l’arrêté de caisse', async () => {
    listeSimulee.mockResolvedValue(unePage([unDocument()]))
    afficher()
    await screen.findByRole('cell', { name: 'Reçu de versement' })

    fireEvent.change(screen.getByLabelText('Type de document'), { target: { value: 'arrete_caisse' } })

    await waitFor(() => expect(listeSimulee).toHaveBeenLastCalledWith({ type: 'arrete_caisse' }, 1, 25))
    expect(screen.getByRole('option', { name: 'Arrêté de caisse' })).toBeInTheDocument()
  })

  it('pagination serveur : « page 1 sur 3 », précédente désactivée sur la première', async () => {
    listeSimulee.mockResolvedValue(unePage([unDocument()], 60))
    afficher()

    expect(await screen.findByText('Page 1 sur 3 — 60 document(s)')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Précédente' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Suivante' }))
    await waitFor(() => expect(listeSimulee).toHaveBeenLastCalledWith({}, 2, 25))
  })

  it('« Télécharger » récupère le PDF puis l’ouvre', async () => {
    const pdf = new Blob(['%PDF'])
    listeSimulee.mockResolvedValue(unePage([unDocument()]))
    telechargerSimule.mockResolvedValue(pdf)
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Télécharger' }))

    await waitFor(() => expect(ouvrirSimule).toHaveBeenCalledWith(pdf, 'recu_versement_EP-1_CA-1.pdf'))
    expect(telechargerSimule).toHaveBeenCalledWith('d1')
  })

  it('refus du serveur au téléchargement : son message métier est affiché', async () => {
    listeSimulee.mockResolvedValue(unePage([unDocument()]))
    telechargerSimule.mockRejectedValue(new ErreurServeurDocument('Le fichier est introuvable.'))
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Télécharger' }))

    expect(await screen.findByText('Le fichier est introuvable.')).toBeVisible()
    expect(ouvrirSimule).not.toHaveBeenCalled()
  })

  it('« Régénérer » rattrape le document puis recharge la liste', async () => {
    listeSimulee.mockResolvedValueOnce(unePage([unDocument({ statut: 'echec' })]))
    regenererSimule.mockResolvedValue({ id: 'd1', nom: 'x.pdf', statut: 'ok' })
    listeSimulee.mockResolvedValue(unePage([unDocument()]))
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Régénérer' }))

    await waitFor(() => expect(regenererSimule).toHaveBeenCalledWith('d1'))
    expect(await screen.findByRole('button', { name: 'Télécharger' })).toBeVisible()
  })

  it('brouillons : absents sans compta.rapport.read', async () => {
    listeSimulee.mockResolvedValue(unePage([unDocument()]))
    afficher()
    await screen.findByRole('cell', { name: 'Reçu de versement' })

    expect(screen.queryByRole('button', { name: /brouillon/ })).toBeNull()
  })

  it('brouillons : avec compta.rapport.read, le journal est demandé puis ouvert', async () => {
    etat.permissions = ['documents.read', 'compta.rapport.read']
    const pdf = new Blob(['%PDF'])
    listeSimulee.mockResolvedValue(unePage([]))
    brouillonSimule.mockResolvedValue(pdf)
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Journal du jour (brouillon)' }))

    await waitFor(() => expect(brouillonSimule).toHaveBeenCalledWith('journal-du-jour'))
    await waitFor(() => expect(ouvrirSimule).toHaveBeenCalledWith(pdf, 'brouillon_journal-du-jour.pdf'))
  })

  it('brouillon refusé (aucune journée ouverte) : le message du serveur s’affiche', async () => {
    etat.permissions = ['documents.read', 'compta.rapport.read']
    listeSimulee.mockResolvedValue(unePage([]))
    brouillonSimule.mockRejectedValue(
      new ErreurServeurDocument("Aucune journée comptable n'est ouverte : il n'y a pas de brouillon."),
    )
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Balance du jour (brouillon)' }))

    const alerte = await screen.findByRole('alert')
    expect(within(alerte).getByText(/Aucune journée comptable/)).toBeVisible()
  })
})
