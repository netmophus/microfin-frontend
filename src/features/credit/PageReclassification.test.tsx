import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { executerReclassement, previsualiserReclassement } from '@/features/credit/api'
import { PageReclassification } from '@/features/credit/PageReclassification'

/**
 * Supervision PERMANENTE des crédits en souffrance (CR5c, chantier supervision lot 2). Points
 * durs : l'état se charge SEUL au montage (pas de clic requis) ; le bouton d'exécution n'existe
 * que pour credit.delinquency.executer, un rôle avec credit.delinquency.read SEUL accède à
 * l'écran en lecture ; un rattachement manquant est DIT avant le clic, pas découvert après ; la
 * confirmation est renforcée (de vraies écritures de provision) ; le rapport final détaille
 * aussi palier avant/après et signale les dossiers ignorés.
 */

const etat = vi.hoisted(() => ({ permissions: ['credit.delinquency.executer'] as string[] }))

vi.mock('@/features/auth/useProfil', () => ({
  useAPermission: (p: string) => etat.permissions.includes(p),
}))

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
  etat.permissions = ['credit.delinquency.executer']
})

describe('PageReclassification', () => {
  it('charge l’état au montage, sans qu’il faille cliquer sur quoi que ce soit', async () => {
    apercuSimule.mockResolvedValue(apercuAvecDossier)
    afficher()

    expect(
      await screen.findByText(/1 dossier\(s\) seraient reclassés, sur 5 dossier\(s\)/),
    ).toBeVisible()
    expect(screen.getByText('CR-2026-0000003')).toBeVisible()
    expect(screen.getByText('Sain')).toBeVisible() // palier avant
    expect(screen.getByText('Souffrance (SOUFFRANCE)')).toBeVisible() // palier après
    expect(apercuSimule).toHaveBeenCalledOnce()
    expect(executionSimulee).not.toHaveBeenCalled() // dry-run : rien exécuté
  })

  it('bouton d’exécution absent sans credit.delinquency.executer — un rôle en lecture seule accède à l’écran', async () => {
    etat.permissions = ['credit.delinquency.read']
    apercuSimule.mockResolvedValue(apercuAvecDossier)
    afficher()

    // L'écran charge et affiche la supervision normalement...
    expect(
      await screen.findByText(/1 dossier\(s\) seraient reclassés, sur 5 dossier\(s\)/),
    ).toBeVisible()
    expect(screen.getByText('CR-2026-0000003')).toBeVisible()
    // ...mais sans le bouton qui déclenche l'exécution.
    expect(screen.queryByRole('button', { name: 'Lancer la reclassification' })).toBeNull()
  })

  it('signale un rattachement manquant AVANT le clic, pas après coup', async () => {
    apercuSimule.mockResolvedValue({
      ...apercuAvecDossier,
      rattachements_manquants: 1,
      lignes: [
        {
          ...apercuAvecDossier.lignes[0]!,
          rattachement_manquant:
            'le palier « Souffrance » n’a pas de compte d’encours rattaché (paramétrage)',
        },
      ],
    })
    afficher()

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

    expect(
      await screen.findByText(/tous les crédits décaissés sont dans le bon palier/),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Lancer la reclassification' })).toBeNull()
  })

  it('chargement de la supervision en échec : message clair et bouton Réessayer', async () => {
    apercuSimule.mockRejectedValue(new Error('échec réseau'))
    afficher()

    expect(
      await screen.findByText('Impossible de charger la supervision de la souffrance.'),
    ).toBeVisible()
    const reessayer = screen.getByRole('button', { name: 'Réessayer' })

    apercuSimule.mockResolvedValue(apercuAvecDossier)
    fireEvent.click(reessayer)

    expect(
      await screen.findByText(/1 dossier\(s\) seraient reclassés, sur 5 dossier\(s\)/),
    ).toBeVisible()
  })
})
