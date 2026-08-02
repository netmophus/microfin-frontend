import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  apercevoirImportComptes,
  confirmerImportComptes,
  exporterComptes,
  listerComptes,
  type ApercuImportComptes,
} from '@/features/comptabilite/api'
import { PagePlanComptable } from '@/features/comptabilite/PagePlanComptable'

/**
 * Import/export CSV (Bloc 2). Points durs : l'aperçu n'écrit rien (anomalies OU diff, jamais
 * les deux), le bouton Confirmer reste bloqué tant que le motif fait moins de 3 caractères,
 * et l'import est invisible sans compta.plan.manage — l'export, lui, reste accessible.
 */

const etat = vi.hoisted(() => ({ permissions: ['compta.plan.manage'] as string[] }))

vi.mock('@/features/auth/useProfil', () => ({
  useAPermission: (p: string) => etat.permissions.includes(p),
}))

vi.mock('@/features/comptabilite/api', async () => {
  const reel =
    await vi.importActual<typeof import('@/features/comptabilite/api')>(
      '@/features/comptabilite/api',
    )
  return {
    ...reel,
    listerComptes: vi.fn(),
    apercevoirImportComptes: vi.fn(),
    confirmerImportComptes: vi.fn(),
    exporterComptes: vi.fn(),
  }
})

const listerSimule = vi.mocked(listerComptes)
const apercuSimule = vi.mocked(apercevoirImportComptes)
const confirmerSimule = vi.mocked(confirmerImportComptes)
const exporterSimule = vi.mocked(exporterComptes)

function fichierCsv(): File {
  return new File(['account_number;name'], 'plan.csv', { type: 'text/csv' })
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PagePlanComptable />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function ouvrirPanneauEtChoisirFichier() {
  fireEvent.click(screen.getByRole('button', { name: /Importer \/ exporter/ }))
  const champFichier = await screen.findByLabelText('Fichier CSV')
  fireEvent.change(champFichier, { target: { files: [fichierCsv()] } })
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.permissions = ['compta.plan.manage']
  listerSimule.mockResolvedValue({ lignes: [], total: 0, page: 1, taille: 25 })
  exporterSimule.mockResolvedValue(undefined)
})

describe('PagePlanComptable — import/export CSV', () => {
  it('le panneau est masqué par défaut, puis apparaît au clic', async () => {
    afficher()
    await screen.findByText(/Aucun compte/i)

    expect(screen.queryByLabelText('Fichier CSV')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Importer \/ exporter/ }))
    expect(await screen.findByLabelText('Fichier CSV')).toBeVisible()
  })

  it('export : déclenche le téléchargement au clic', async () => {
    afficher()
    await screen.findByText(/Aucun compte/i)
    fireEvent.click(screen.getByRole('button', { name: /Importer \/ exporter/ }))

    fireEvent.click(await screen.findByRole('button', { name: 'Exporter en CSV' }))

    await waitFor(() => expect(exporterSimule).toHaveBeenCalledWith(true))
  })

  it('import masqué sans compta.plan.manage — export reste accessible', async () => {
    etat.permissions = []
    afficher()
    await screen.findByText(/Aucun compte/i)
    fireEvent.click(screen.getByRole('button', { name: /Importer \/ exporter/ }))

    expect(await screen.findByRole('button', { name: 'Exporter en CSV' })).toBeVisible()
    expect(screen.queryByLabelText('Fichier CSV')).toBeNull()
  })

  it('aperçu avec anomalies : liste les anomalies, aucune section de confirmation', async () => {
    apercuSimule.mockResolvedValue({
      anomalies: ['ligne 2 (compte 6033) : libellé (name) vide'],
      empreinte: null,
      a_creer: [],
      a_modifier: [],
      inchanges: 0,
    })
    afficher()
    await screen.findByText(/Aucun compte/i)
    await ouvrirPanneauEtChoisirFichier()

    fireEvent.click(screen.getByRole('button', { name: 'Aperçu' }))

    expect(await screen.findByText(/libellé \(name\) vide/)).toBeVisible()
    expect(screen.queryByLabelText('Motif (obligatoire)')).toBeNull()
  })

  it('aperçu propre : distingue créations et modifications, montre le diff avant/après', async () => {
    const resultat: ApercuImportComptes = {
      anomalies: [],
      empreinte: 'abc123',
      a_creer: [{ account_number: '6034', name: 'Compte neuf', diffs: [] }],
      a_modifier: [
        {
          account_number: '6033',
          name: 'Charges diverses',
          diffs: [{ champ: 'name', avant: 'Ancien libellé', apres: 'Charges diverses' }],
        },
      ],
      inchanges: 3,
    }
    apercuSimule.mockResolvedValue(resultat)
    afficher()
    await screen.findByText(/Aucun compte/i)
    await ouvrirPanneauEtChoisirFichier()
    fireEvent.click(screen.getByRole('button', { name: 'Aperçu' }))

    expect(await screen.findByText('1 compte à créer')).toBeVisible()
    expect(screen.getByText('1 compte à modifier')).toBeVisible()
    expect(screen.getByText(/Ancien libellé → Charges diverses/)).toBeVisible()
    expect(screen.getByText('3 comptes inchangés')).toBeVisible()
  })

  it('confirmer : bloqué sans motif suffisant, puis appelle avec le MÊME fichier et l’empreinte', async () => {
    apercuSimule.mockResolvedValue({
      anomalies: [],
      empreinte: 'empreinte-xyz',
      a_creer: [{ account_number: '6034', name: 'Compte neuf', diffs: [] }],
      a_modifier: [],
      inchanges: 0,
    })
    confirmerSimule.mockResolvedValue({ crees: 1, mis_a_jour: 0, provisoire_leve: false })
    afficher()
    await screen.findByText(/Aucun compte/i)
    await ouvrirPanneauEtChoisirFichier()
    fireEvent.click(screen.getByRole('button', { name: 'Aperçu' }))
    await screen.findByText('1 compte à créer')

    const confirmer = screen.getByRole('button', { name: 'Confirmer l’import' })
    expect(confirmer).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Motif (obligatoire)'), {
      target: { value: 'Correction du plan' },
    })
    expect(confirmer).not.toBeDisabled()
    fireEvent.click(confirmer)

    await waitFor(() =>
      expect(confirmerSimule).toHaveBeenCalledWith(
        expect.objectContaining({
          empreinte: 'empreinte-xyz',
          motif: 'Correction du plan',
          leverProvisoire: false,
        }),
      ),
    )
    expect(await screen.findByText(/Import terminé : 1 compte\(s\) créé\(s\)/)).toBeVisible()
  })

  it('la case « lever le provisoire » est décochée par défaut', async () => {
    apercuSimule.mockResolvedValue({
      anomalies: [],
      empreinte: 'empreinte-xyz',
      a_creer: [{ account_number: '6034', name: 'Compte neuf', diffs: [] }],
      a_modifier: [],
      inchanges: 0,
    })
    afficher()
    await screen.findByText(/Aucun compte/i)
    await ouvrirPanneauEtChoisirFichier()
    fireEvent.click(screen.getByRole('button', { name: 'Aperçu' }))
    await screen.findByText('1 compte à créer')

    const caseProvisoire = screen.getByText(/validation définitive de l’expert/).closest('label')
    expect(caseProvisoire?.querySelector('input[type="checkbox"]')).not.toBeChecked()
  })

  it('un fichier propre sans aucun changement n’ouvre pas de section motif', async () => {
    apercuSimule.mockResolvedValue({
      anomalies: [],
      empreinte: 'empreinte-xyz',
      a_creer: [],
      a_modifier: [],
      inchanges: 5,
    })
    afficher()
    await screen.findByText(/Aucun compte/i)
    await ouvrirPanneauEtChoisirFichier()
    fireEvent.click(screen.getByRole('button', { name: 'Aperçu' }))

    expect(await screen.findByText(/ne change rien au plan actuel/)).toBeVisible()
    expect(screen.queryByLabelText('Motif (obligatoire)')).toBeNull()
  })
})
