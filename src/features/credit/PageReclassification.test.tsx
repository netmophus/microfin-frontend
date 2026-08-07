import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { executerReclassement, previsualiserReclassement } from '@/features/credit/api'
import { PageReclassification } from '@/features/credit/PageReclassification'

/**
 * Reclassification des crédits en souffrance (CR5c). Points durs : la PRÉVISUALISATION
 * obligatoire montre ce qui SERAIT reclassé (palier avant/après par dossier) sans rien écrire ;
 * un rattachement manquant est DIT avant le clic, pas découvert après ; la confirmation est
 * renforcée (de vraies écritures de provision) ; le rapport final détaille aussi palier
 * avant/après et signale les dossiers ignorés.
 */

vi.mock('@/features/credit/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/credit/api')>(
    '@/features/credit/api',
  )
  return { ...reel, previsualiserReclassement: vi.fn(), executerReclassement: vi.fn() }
})

const apercuSimule = vi.mocked(previsualiserReclassement)
const executionSimulee = vi.mocked(executerReclassement)

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PageReclassification />
    </QueryClientProvider>,
  )
}

function lancerApercu() {
  fireEvent.click(screen.getByRole('button', { name: 'Prévisualiser' }))
}

const apercuAvecDossier = {
  dossiers_evalues: 5,
  a_reclasser: 1,
  rattachements_manquants: 0,
  lignes: [
    {
      application_number: 'CR-2026-0000003',
      tier_avant_code: null,
      tier_avant_libelle: null,
      tier_apres_code: 'SOUFFRANCE',
      tier_apres_libelle: 'Souffrance',
      jours_retard: 37,
      encours_actuel: 100000,
      provision_avant: 0,
      provision_apres: 10000,
      rattachement_manquant: null,
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PageReclassification', () => {
  it('prévisualise : montre le palier avant/après par dossier, sans rien reclasser', async () => {
    apercuSimule.mockResolvedValue(apercuAvecDossier)
    afficher()
    lancerApercu()

    expect(
      await screen.findByText(/1 dossier\(s\) seraient reclassés, sur 5 dossier\(s\)/),
    ).toBeVisible()
    expect(screen.getByText('CR-2026-0000003')).toBeVisible()
    expect(screen.getByText('Sain')).toBeVisible() // palier avant
    expect(screen.getByText('Souffrance (SOUFFRANCE)')).toBeVisible() // palier après
    expect(executionSimulee).not.toHaveBeenCalled() // dry-run : rien exécuté
  })

  it('signale un rattachement manquant AVANT le clic, pas après coup', async () => {
    apercuSimule.mockResolvedValue({
      ...apercuAvecDossier,
      rattachements_manquants: 1,
      lignes: [
        {
          ...apercuAvecDossier.lignes[0],
          rattachement_manquant:
            'le palier « Souffrance » n’a pas de compte d’encours rattaché (paramétrage)',
        },
      ],
    })
    afficher()
    lancerApercu()

    expect(
      await screen.findByText(/1 dossier\(s\) échoueraient faute de compte rattaché/),
    ).toBeVisible()
    expect(screen.getByText(/Échouerait : le palier « Souffrance »/)).toBeVisible()
  })

  it('lancer exige une confirmation renforcée, puis rend le rapport détaillé', async () => {
    apercuSimule.mockResolvedValue(apercuAvecDossier)
    executionSimulee.mockResolvedValue({
      dossiers_evalues: 5,
      reclasses: 1,
      ignores_rattachement_manquant: [],
      lignes: [
        {
          application_number: 'CR-2026-0000003',
          tier_avant_code: null,
          tier_avant_libelle: null,
          tier_apres_code: 'SOUFFRANCE',
          tier_apres_libelle: 'Souffrance',
          jours_retard: 37,
          encours_actuel: 100000,
          provision_avant: 0,
          provision_apres: 10000,
        },
      ],
    })
    afficher()
    lancerApercu()

    fireEvent.click(await screen.findByRole('button', { name: 'Lancer la reclassification' }))
    // Confirmation renforcée : on énonce qu'on va poser de vraies écritures.
    expect(await screen.findByText(/Confirmer la reclassification/)).toBeVisible()
    expect(screen.getByText(/Vous allez reclasser 1 dossier\(s\) sur 5 évalués/)).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Lancer la reclassification' }))
    await waitFor(() => expect(executionSimulee).toHaveBeenCalledOnce())
    expect(await screen.findByText(/1 dossier\(s\) reclassé\(s\), sur 5 évalués/)).toBeVisible()
    // Le rapport détaille aussi le palier avant/après.
    expect(screen.getByText('CR-2026-0000003')).toBeVisible()
    expect(screen.getByText('Souffrance (SOUFFRANCE)')).toBeVisible()
  })

  it('rapport avec dossiers ignorés : le dit, ne le cache pas', async () => {
    apercuSimule.mockResolvedValue(apercuAvecDossier)
    executionSimulee.mockResolvedValue({
      dossiers_evalues: 5,
      reclasses: 0,
      ignores_rattachement_manquant: ['CR-2026-0000003'],
      lignes: [],
    })
    afficher()
    lancerApercu()
    fireEvent.click(await screen.findByRole('button', { name: 'Lancer la reclassification' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Lancer la reclassification' }))

    expect(await screen.findByText(/Aucun dossier n’a été reclassé/)).toBeVisible()
    expect(
      screen.getByText(/1 dossier\(s\) ignoré\(s\), faute de rattachement : CR-2026-0000003/),
    ).toBeVisible()
  })

  it('rien à reclasser : on le dit, pas de bouton de confirmation', async () => {
    apercuSimule.mockResolvedValue({
      dossiers_evalues: 5,
      a_reclasser: 0,
      rattachements_manquants: 0,
      lignes: [],
    })
    afficher()
    lancerApercu()

    expect(
      await screen.findByText(/tous les crédits décaissés sont dans le bon palier/),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Lancer la reclassification' })).toBeNull()
  })
})
