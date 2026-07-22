import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ErreurAudit, listerAudit, type LigneAudit } from '@/features/audit/api'
import { PageJournalAudit } from '@/features/audit/PageJournalAudit'

/**
 * Journal d'audit — surtout la TRADUCTION des codes en français lisible. Un directeur ou un
 * auditeur ne doit jamais voir « user.created » ou « auth.token.reuse_detected » bruts.
 */

vi.mock('@/features/audit/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/audit/api')>('@/features/audit/api')
  return { ...reel, listerAudit: vi.fn() }
})

const listerSimule = vi.mocked(listerAudit)

function ligne(partiel: Partial<LigneAudit>): LigneAudit {
  return {
    id: crypto.randomUUID(),
    occurred_at: '2026-07-20T14:30:00Z',
    action: 'user.created',
    acteur_id: 'a1',
    acteur_nom: 'Amadou Diallo',
    resource_type: 'user',
    cible_id: 'c1',
    cible_nom: 'Fatou Traoré',
    ip_address: null,
    old_values: null,
    new_values: null,
    ...partiel,
  }
}

function page(lignes: LigneAudit[]) {
  return { lignes, total: lignes.length, page: 1, taille: 25 }
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PageJournalAudit />
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('PageJournalAudit', () => {
  it('traduit les codes d’action en français lisible', async () => {
    listerSimule.mockResolvedValue(
      page([
        ligne({ action: 'user.created' }),
        ligne({ action: 'auth.token.reuse_detected', acteur_nom: null, cible_nom: null }),
      ]),
    )

    afficher()

    expect(await screen.findByText('Création d’un utilisateur')).toBeVisible()
    expect(screen.getByText('Réutilisation de jeton détectée')).toBeVisible()
    // Surtout : aucun code technique brut à l'écran.
    expect(screen.queryByText('user.created')).toBeNull()
    expect(screen.queryByText(/reuse_detected/)).toBeNull()
  })

  it('affiche l’auteur et la personne concernée par leur nom', async () => {
    listerSimule.mockResolvedValue(page([ligne({})]))

    afficher()

    expect(await screen.findByText('Amadou Diallo')).toBeVisible()
    expect(screen.getByText('Fatou Traoré')).toBeVisible()
  })

  it('montre « Système » quand il n’y a pas d’auteur (événement d’authentification)', async () => {
    listerSimule.mockResolvedValue(
      page([ligne({ action: 'auth.login.success', acteur_nom: null, cible_nom: null })]),
    )

    afficher()

    expect(await screen.findByText('Système')).toBeVisible()
  })

  it('déplie le détail : valeurs avant/après et adresse IP', async () => {
    listerSimule.mockResolvedValue(
      page([
        ligne({
          action: 'user.updated',
          ip_address: '203.0.113.7',
          old_values: { phone: null },
          new_values: { phone: '70000000' },
        }),
      ]),
    )

    afficher()
    await userEvent.setup().click(await screen.findByRole('button', { name: /voir/i }))

    expect(screen.getByText(/203\.0\.113\.7/)).toBeVisible()
    expect(screen.getByText('70000000')).toBeVisible()
  })

  it('base vide : un message, pas un tableau vide', async () => {
    listerSimule.mockResolvedValue(page([]))

    afficher()

    expect(await screen.findByText(/aucune entrée/i)).toBeVisible()
  })

  it('403 : nomme le manque de permission', async () => {
    listerSimule.mockRejectedValue(new ErreurAudit({ type: 'interdit' }))

    afficher()

    expect(await screen.findByRole('alert')).toHaveTextContent(/pas la permission/i)
  })

  it('le filtre d’action est transmis au serveur', async () => {
    listerSimule.mockResolvedValue(page([]))

    afficher()
    await screen.findByText(/aucune entrée/i)
    await userEvent.setup().selectOptions(screen.getByLabelText(/type d’action/i), 'user.deleted')

    expect(listerSimule).toHaveBeenCalledWith(expect.objectContaining({ action: 'user.deleted' }))
  })
})
