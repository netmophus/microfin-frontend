import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PageGuichet } from '@/features/epargne/PageGuichet'

/**
 * Le guichet à ONGLETS (Épargne / Parts sociales / Crédit). Points durs : chaque onglet
 * n'apparaît que pour qui en a l'usage, et un seul droit suffit à entrer sur l'écran (les
 * autres onglets sont simplement absents — pas d'onglet vide ni d'erreur), la barre d'onglets
 * ne s'affiche que si PLUS D'UN est disponible. Les enfants sont mockés : ce fichier teste la
 * COMPOSITION (onglets, gating), pas le contenu de chaque onglet (testé ailleurs).
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
vi.mock('@/features/credit/OngletGuichetCredit', () => ({
  OngletGuichetCredit: () => <div>contenu-credit</div>,
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

  it('les trois droits : les trois onglets, clic sur Crédit bascule le contenu', () => {
    etat.permissions = ['epargne.operation.deposit', 'tiers.shares.pay', 'credit.remboursement.create']
    render(<PageGuichet />)

    expect(screen.getByRole('tab', { name: 'Épargne' })).toBeVisible()
    expect(screen.getByRole('tab', { name: 'Parts sociales' })).toBeVisible()
    expect(screen.getByRole('tab', { name: 'Crédit' })).toBeVisible()

    fireEvent.click(screen.getByRole('tab', { name: 'Crédit' }))

    expect(screen.getByText('contenu-credit')).toBeVisible()
    expect(screen.queryByText('contenu-epargne')).toBeNull()
    expect(screen.queryByText('contenu-parts')).toBeNull()
  })

  it('seulement credit.remboursement.create : pas d’onglets, directement le contenu Crédit', () => {
    etat.permissions = ['credit.remboursement.create']
    render(<PageGuichet />)

    expect(screen.queryByRole('tab')).toBeNull()
    expect(screen.getByText('contenu-credit')).toBeVisible()
    expect(screen.queryByText('contenu-epargne')).toBeNull()
    expect(screen.queryByText('contenu-parts')).toBeNull()
  })
})
