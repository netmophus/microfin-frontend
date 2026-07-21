import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { BarreLaterale } from '@/features/navigation/BarreLaterale'
import { menuVisible } from '@/features/navigation/menu'

/**
 * Le menu ne triche pas : ce qui existe est cliquable, ce qui est à venir est visible mais
 * explicitement indisponible, et une entrée dont la permission manque n'apparaît pas.
 */

function afficher(permissions: string[]) {
  return render(
    <MemoryRouter>
      <BarreLaterale permissions={permissions} />
    </MemoryRouter>,
  )
}

describe('BarreLaterale', () => {
  it('rend « Utilisateurs » comme un vrai lien quand users.read est détenu', () => {
    afficher(['users.read'])
    const lien = screen.getByRole('link', { name: 'Utilisateurs' })
    expect(lien).toHaveAttribute('href', '/')
  })

  it('CACHE « Utilisateurs » quand users.read manque', () => {
    afficher([])
    expect(screen.queryByText('Utilisateurs')).toBeNull()
  })

  it('affiche les entrées à venir mais NON cliquables', () => {
    afficher(['users.read'])
    const credit = screen.getByText('Crédit')
    // Ni lien, ni bouton : rien à cliquer. Et marqué indisponible pour l'accessibilité.
    expect(credit.closest('a')).toBeNull()
    expect(credit).toHaveAttribute('aria-disabled', 'true')
  })

  it('montre tous les groupes, y compris ceux sans entrée active', () => {
    afficher(['users.read'])
    for (const titre of ['Administration', 'Opérations', 'Comptabilité', 'Système']) {
      expect(screen.getByText(titre)).toBeVisible()
    }
  })
})

describe('menuVisible', () => {
  it('retire les entrées actives dont la permission manque, garde les à venir', () => {
    const sansPermission = menuVisible([])
    const admin = sansPermission.find((g) => g.id === 'administration')
    // Utilisateurs (actif, users.read) retiré ; les à venir du groupe restent.
    expect(admin?.entrees.some((e) => e.libelle === 'Utilisateurs')).toBe(false)
    expect(admin?.entrees.some((e) => e.etat === 'a_venir')).toBe(true)
  })

  it('n’expose aucun chemin sur une entrée à venir (garde-fou anti-fausse-promesse)', () => {
    for (const groupe of menuVisible(['users.read'])) {
      for (const entree of groupe.entrees) {
        if (entree.etat === 'a_venir') {
          expect('chemin' in entree).toBe(false)
        }
      }
    }
  })
})
