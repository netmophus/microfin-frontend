import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ActionsTier } from '@/features/tiers/actions-tier'
import {
  ErreurTransition,
  executerTransition,
  lireEngagementsDesactivation,
  type FicheTier,
} from '@/features/tiers/api'

/**
 * Boutons de transition — selon le statut ET les permissions, avec confirmation. Le cas
 * important : « Activer » affiche TOUTES les conditions manquantes (conception T1e/T3), pas la
 * première ni un message générique.
 */

const etat = vi.hoisted(() => ({ permissions: [] as string[] }))

vi.mock('@/features/auth/useProfil', () => ({
  useProfil: () => ({ data: { permissions: etat.permissions } }),
  useAPermission: (p: string) => etat.permissions.includes(p),
}))

vi.mock('@/features/tiers/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/tiers/api')>('@/features/tiers/api')
  return { ...reel, executerTransition: vi.fn(), lireEngagementsDesactivation: vi.fn() }
})

const executerSimule = vi.mocked(executerTransition)
const engagementsSimule = vi.mocked(lireEngagementsDesactivation)

function fiche(partiel: Partial<FicheTier>): FicheTier {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    tier_number: 'M-2026-0000001',
    tier_type: 'individual',
    status: 'actif',
    primary_agency_id: 'a1',
    ...partiel,
  }
}

function afficher(f: FicheTier) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ActionsTier tier={f} onChangement={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.permissions = []
  engagementsSimule.mockResolvedValue([]) // par défaut : aucun blocage
})

describe('ActionsTier', () => {
  it('propose les actions selon le statut (actif) et masque les illégales', () => {
    etat.permissions = ['tiers.suspend', 'tiers.deactivate', 'tiers.validate']

    afficher(fiche({ status: 'actif', tier_type: 'individual' }))

    expect(screen.getByRole('button', { name: 'Suspendre' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Enregistrer le décès' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Désactiver' })).toBeVisible()
    // Réactiver n'a de sens que sur une fiche suspendue ; Activer que sur une prospect.
    expect(screen.queryByRole('button', { name: 'Réactiver' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Activer' })).toBeNull()
  })

  it('un chargé de clientèle (sans tiers.deactivate) ne voit pas « Désactiver »', () => {
    etat.permissions = ['tiers.suspend']

    afficher(fiche({ status: 'actif', tier_type: 'individual' }))

    expect(screen.getByRole('button', { name: 'Suspendre' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Désactiver' })).toBeNull()
  })

  it('« Activer » affiche TOUTES les conditions manquantes renvoyées par le 412', async () => {
    etat.permissions = ['tiers.validate']
    executerSimule.mockRejectedValue(
      new ErreurTransition({
        type: 'conditions',
        conditions: [
          { code: 'KYC_NON_VALIDE', libelle: 'Validation KYC requise — module à venir.' },
          { code: 'PIECE_NON_VERIFIEE', libelle: 'Pièce d’identité non vérifiée.' },
        ],
      }),
    )

    afficher(fiche({ status: 'prospect', tier_type: 'individual' }))
    await userEvent.setup().click(screen.getByRole('button', { name: 'Activer' }))

    // Les DEUX conditions, pas seulement la première.
    expect(await screen.findByText('Validation KYC requise — module à venir.')).toBeVisible()
    expect(screen.getByText('Pièce d’identité non vérifiée.')).toBeVisible()
  })

  it('« Suspendre » confirme (avec motif) avant d’appeler le backend', async () => {
    etat.permissions = ['tiers.suspend']
    executerSimule.mockResolvedValue(fiche({ status: 'suspendu_temporaire' }))
    const user = userEvent.setup()

    afficher(fiche({ status: 'actif', tier_type: 'individual' }))
    await user.click(screen.getByRole('button', { name: 'Suspendre' }))

    // Une confirmation apparaît, avec un champ motif — rien n'est encore appelé.
    const dialogue = screen.getByRole('alertdialog')
    expect(within(dialogue).getByText(/Suspendre cette fiche/i)).toBeVisible()
    expect(within(dialogue).getByLabelText(/Motif/i)).toBeVisible()
    expect(executerSimule).not.toHaveBeenCalled()

    // Sur confirmation, l'appel part avec l'action 'suspend'.
    await user.click(within(dialogue).getByRole('button', { name: 'Suspendre' }))
    await waitFor(() => expect(executerSimule).toHaveBeenCalledWith('suspend', expect.any(String), null))
  })

  it('« Réactiver la fiche » sur un désactivé exige tiers.deactivate et explique le retour en prospect', async () => {
    etat.permissions = ['tiers.deactivate']
    afficher(fiche({ status: 'desactive', tier_type: 'individual' }))

    const bouton = screen.getByRole('button', { name: 'Réactiver la fiche' })
    await userEvent.setup().click(bouton)

    const dialogue = screen.getByRole('alertdialog')
    // La confirmation dit clairement : retour dans l'annuaire en prospect, à re-valider (pas actif).
    expect(within(dialogue).getByText(/reviendra dans l.annuaire/i)).toBeVisible()
    expect(within(dialogue).getByText(/validation KYC/i)).toBeVisible()
  })

  it('sans tiers.deactivate, aucune réactivation sur un désactivé', () => {
    etat.permissions = ['tiers.read.deleted'] // il peut VOIR le désactivé, pas le réactiver
    afficher(fiche({ status: 'desactive', tier_type: 'individual' }))

    expect(screen.queryByRole('button', { name: 'Réactiver la fiche' })).toBeNull()
  })

  it('« Désactiver » avec engagements : AUCUN bouton Confirmer, on affiche ce qui bloque et quoi faire', async () => {
    etat.permissions = ['tiers.deactivate']
    engagementsSimule.mockResolvedValue([
      {
        domaine: 'parts_sociales',
        reference: 'x',
        libelle:
          'Ce membre détient 10 part(s) sociale(s) — capital 50 000 F. Remboursez-les avant de le désactiver.',
      },
      {
        domaine: 'epargne',
        reference: 'EP-1',
        libelle: 'Ce membre a un compte d’épargne EP-1 ouvert (solde 0) : fermez-le avant de désactiver.',
      },
    ])
    const user = userEvent.setup()

    afficher(fiche({ status: 'actif', tier_type: 'individual' }))
    await user.click(screen.getByRole('button', { name: 'Désactiver' }))
    const dialogue = screen.getByRole('alertdialog')

    // Les DEUX blocages (parts + épargne), traités du même motif, avec le message actionnable.
    expect(await within(dialogue).findByText(/Remboursez-les avant/)).toBeVisible()
    expect(within(dialogue).getByText(/fermez-le avant/)).toBeVisible()
    expect(within(dialogue).getByText(/Désactivation impossible/)).toBeVisible()
    // Pas de bouton qui échouerait.
    expect(
      within(dialogue).queryByRole('button', { name: 'Désactiver définitivement' }),
    ).toBeNull()
    expect(executerSimule).not.toHaveBeenCalled()
  })

  it('« Désactiver » sans engagement : le bouton Confirmer est proposé', async () => {
    etat.permissions = ['tiers.deactivate']
    engagementsSimule.mockResolvedValue([]) // plus aucun engagement
    const user = userEvent.setup()

    afficher(fiche({ status: 'actif', tier_type: 'individual' }))
    await user.click(screen.getByRole('button', { name: 'Désactiver' }))
    const dialogue = screen.getByRole('alertdialog')

    // Le bouton revient quand il n'y a plus de blocage.
    expect(
      await within(dialogue).findByRole('button', { name: 'Désactiver définitivement' }),
    ).toBeVisible()
  })

  it('une collision de pièce à la restauration nomme la fiche avec un lien', async () => {
    etat.permissions = ['tiers.deactivate']
    executerSimule.mockRejectedValue(
      new ErreurTransition({
        type: 'doublon',
        message: 'Cette pièce est déjà enregistrée sur la fiche M-2026-42.',
        tierId: 'tid-42',
        nom: 'Traore',
      }),
    )
    const user = userEvent.setup()

    afficher(fiche({ status: 'desactive', tier_type: 'individual' }))
    await user.click(screen.getByRole('button', { name: 'Réactiver la fiche' }))
    const dialogue = screen.getByRole('alertdialog')
    await user.click(within(dialogue).getByRole('button', { name: 'Réactiver (retour en prospect)' }))

    const lien = await screen.findByRole('link', { name: /Voir la fiche/ })
    expect(lien).toHaveAttribute('href', '/tiers/tid-42')
  })
})
