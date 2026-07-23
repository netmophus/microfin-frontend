import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { lireTier, lireTimeline, type FicheTier } from '@/features/tiers/api'
import { PageFicheTier } from '@/features/tiers/PageFicheTier'

/**
 * Fiche adaptative — le point dur : le front ne suppose JAMAIS la présence des blocs sensibles.
 * Un caissier (read.basic) reçoit un résumé SANS bloc de détail ; l'écran affiche ce qui est là
 * et ne casse pas. C'est le cas nominal, pas une erreur.
 */

const etat = vi.hoisted(() => ({ permissions: [] as string[] }))

vi.mock('@/features/auth/useProfil', () => ({
  useProfil: () => ({ data: { permissions: etat.permissions } }),
  useAPermission: (p: string) => etat.permissions.includes(p),
}))

vi.mock('@/features/tiers/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/tiers/api')>('@/features/tiers/api')
  return { ...reel, lireTier: vi.fn(), lireTimeline: vi.fn() }
})

vi.mock('@/features/utilisateurs/agences', () => ({
  listerAgences: vi.fn().mockResolvedValue([{ id: 'a1', code: 'AG1', name: 'Agence Centre' }]),
}))

const lireSimule = vi.mocked(lireTier)
const timelineSimule = vi.mocked(lireTimeline)
const ID = '11111111-1111-1111-1111-111111111111'

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/tiers/${ID}`]}>
        <Routes>
          <Route path="/tiers/:id" element={<PageFicheTier />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const RESUME: FicheTier = {
  id: ID,
  tier_number: 'M-2026-0000001',
  tier_type: 'individual',
  status: 'prospect',
  primary_agency_id: 'a1',
  display_name: 'Diallo Amadou',
  // AUCUN bloc individu/personne_morale/groupement : c'est la vue read.basic.
}

const COMPLETE: FicheTier = {
  id: ID,
  tier_number: 'M-2026-0000001',
  tier_type: 'individual',
  status: 'prospect',
  primary_agency_id: 'a1',
  primary_phone: '70000000',
  created_at: '2026-07-23T10:00:00Z',
  updated_at: '2026-07-23T10:00:00Z',
  individu: {
    last_name: 'Diallo',
    first_name: 'Amadou',
    middle_names: null,
    name_at_birth: null,
    birth_date: '1990-05-12',
    birth_place: null,
    birth_country_id: null,
    gender: 'M',
    nationality_id: 'p1',
    secondary_nationality_id: null,
    marital_status: null,
    dependents_count: 0,
    profession: 'Commerçante',
    monthly_income_estimate: '150000.00',
    is_literate: true,
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.permissions = []
})

describe('PageFicheTier', () => {
  it('vue résumée (caissier) : aucun champ sensible, et ne casse pas sur les blocs absents', async () => {
    etat.permissions = ['tiers.read.basic'] // PAS tiers.read
    lireSimule.mockResolvedValue(RESUME)

    afficher()

    expect(await screen.findByText('Diallo Amadou')).toBeVisible()
    expect(screen.getByText('Vue limitée.')).toBeVisible()
    // Rien de sensible : ni profession, ni revenus.
    expect(screen.queryByText('Commerçante')).toBeNull()
    expect(screen.queryByText('150000.00')).toBeNull()
    // La frise n'est même pas demandée (elle exige tiers.read).
    expect(timelineSimule).not.toHaveBeenCalled()
  })

  it('vue complète (tiers.read) : détail + frise', async () => {
    etat.permissions = ['tiers.read', 'tiers.read.basic']
    lireSimule.mockResolvedValue(COMPLETE)
    timelineSimule.mockResolvedValue([
      {
        occurred_at: '2026-07-23T10:00:00Z',
        event_type: 'created',
        previous_status: null,
        new_status: 'prospect',
        reason: null,
        auteur_nom: 'Fatou Ba',
      },
    ])

    afficher()

    expect(await screen.findByText('Diallo Amadou')).toBeVisible()
    expect(screen.getByText('Commerçante')).toBeVisible() // détail présent
    // La frise, avec le code traduit en français (pas 'created').
    expect(await screen.findByText('Création de la fiche')).toBeVisible()
  })

  it('le statut prospect est expliqué (on ne triche pas)', async () => {
    etat.permissions = ['tiers.read', 'tiers.read.basic']
    lireSimule.mockResolvedValue(COMPLETE)
    timelineSimule.mockResolvedValue([])

    afficher()

    await screen.findByText('Diallo Amadou')
    expect(screen.getByText(/en attente de validation KYC/i)).toBeVisible()
  })
})
