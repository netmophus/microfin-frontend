import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RoutePermission } from '@/features/auth/RoutePermission'

/**
 * Garde de route par permission — corrige le défaut signalé : atterrir sur une URL mémorisée
 * qu'on n'a pas le droit de voir affichait une erreur ROUGE. Ici : redirection calme, jamais
 * de refus sur un écran non demandé.
 */

const etat = vi.hoisted(() => ({ permissions: [] as string[], pending: false }))

vi.mock('@/features/auth/useProfil', () => ({
  useProfil: () => ({ isPending: etat.pending, data: { permissions: etat.permissions } }),
  useAPermission: (p: string) => etat.permissions.includes(p),
}))

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/protege']}>
        <Routes>
          <Route path="/" element={<div>ACCUEIL</div>} />
          <Route
            path="/protege"
            element={
              <RoutePermission permission="tiers.read.basic">
                <div>CONTENU PROTÉGÉ</div>
              </RoutePermission>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  etat.permissions = []
  etat.pending = false
})

describe('RoutePermission', () => {
  it('sans la permission : redirige vers l’accueil, aucun refus rouge affiché', () => {
    afficher()

    expect(screen.getByText('ACCUEIL')).toBeVisible()
    expect(screen.queryByText('CONTENU PROTÉGÉ')).toBeNull()
    expect(screen.queryByText(/permission/i)).toBeNull() // pas d'erreur rouge
  })

  it('avec la permission : rend l’écran', () => {
    etat.permissions = ['tiers.read.basic']
    afficher()

    expect(screen.getByText('CONTENU PROTÉGÉ')).toBeVisible()
  })

  it('pendant le chargement du profil : n’expulse pas (attend avant de décider)', () => {
    etat.pending = true
    afficher()

    // Ni le contenu (pas encore décidé), ni une redirection prématurée vers l'accueil.
    expect(screen.queryByText('CONTENU PROTÉGÉ')).toBeNull()
    expect(screen.queryByText('ACCUEIL')).toBeNull()
  })
})
