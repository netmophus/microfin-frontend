import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PageGuichet } from '@/features/epargne/PageGuichet'

/**
 * Le guichet à ONGLETS (Épargne / Parts sociales). Points durs : chaque onglet n'apparaît que
 * pour qui en a l'usage, et un seul droit suffit à entrer sur l'écran (l'autre onglet est
 * simplement absent — pas d'onglet vide ni d'erreur). Les enfants sont mockés : ce fichier teste
 * la COMPOSITION (onglets, gating), pas le contenu de chaque onglet (testé ailleurs).
 */

const etat = vi.hoisted(() => ({ permissions: [] as string[] }))

vi.mock('@/features/auth/useProfil', () => ({
  useAPermission: (p: string) => etat.permissions.includes(p),
}))

vi.mock('@/features/epargne/OngletGuichetEpargne', () => ({
  OngletGuichetEpargne: () => <div>contenu-epargne</div>,
}))
vi.mock('@/features/tiers/OngletGuichetParts', () => ({
  OngletGuichetParts: () => <div>contenu-parts</div>,
}))

beforeEach(() => {
  etat.permissions = []
})

describe('PageGuichet', () => {
  it('caissier avec les deux droits : les deux onglets, Épargne actif par défaut', () => {
    etat.permissions = ['epargne.operation.deposit', 'tiers.shares.pay']
    render(<PageGuichet />)

    expect(screen.getByRole('tab', { name: 'Épargne' })).toBeVisible()
    expect(screen.getByRole('tab', { name: 'Parts sociales' })).toBeVisible()
    expect(screen.getByText('contenu-epargne')).toBeVisible()
    expect(screen.queryByText('contenu-parts')).toBeNull()
  })

  it('clic sur l’onglet Parts sociales bascule le contenu', () => {
    etat.permissions = ['epargne.operation.deposit', 'tiers.shares.pay']
    render(<PageGuichet />)

    fireEvent.click(screen.getByRole('tab', { name: 'Parts sociales' }))

    expect(screen.getByText('contenu-parts')).toBeVisible()
    expect(screen.queryByText('contenu-epargne')).toBeNull()
  })

  it('seulement tiers.shares.pay : pas d’onglets, directement le contenu Parts', () => {
    etat.permissions = ['tiers.shares.pay']
    render(<PageGuichet />)

    expect(screen.queryByRole('tab')).toBeNull()
    expect(screen.getByText('contenu-parts')).toBeVisible()
    expect(screen.queryByText('contenu-epargne')).toBeNull()
  })

  it('seulement epargne.operation.deposit : pas d’onglets, directement le contenu Épargne', () => {
    etat.permissions = ['epargne.operation.deposit']
    render(<PageGuichet />)

    expect(screen.queryByRole('tab')).toBeNull()
    expect(screen.getByText('contenu-epargne')).toBeVisible()
    expect(screen.queryByText('contenu-parts')).toBeNull()
  })
})
