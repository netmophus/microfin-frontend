import { render, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CertificatDepotATerme,
  type PropsCertificatDepotATerme,
} from '@/features/documents/CertificatDepotATerme'

/**
 * Bon (certificat) de dépôt à terme : le contrat remis au client. Toutes les valeurs sont celles
 * du contrat figé ; la date est la journée comptable du placement, jamais l'horloge ; la
 * signature du client y est obligatoire ; deux exemplaires ; masqué à l'écran.
 */

const etat = vi.hoisted(() => ({
  institution: {
    nom: 'IMCEC Test',
    adresse: '',
    telephone: '',
    numero_agrement: '',
  },
}))

vi.mock('@/features/auth/useProfil', () => ({
  useProfil: () => ({
    data: {
      username: 'caissier1',
      last_name: 'Souley',
      first_name: 'Awa',
      agence_courante: { id: 'a1', code: 'AG-001', name: 'Siège' },
      institution: etat.institution,
    },
  }),
}))

function bon(o: Partial<PropsCertificatDepotATerme> = {}): PropsCertificatDepotATerme {
  return {
    numeroCompte: 'DT-2026-0000007',
    membre: 'Diallo Amadou',
    capital: 1_000_000,
    depart: '2026-10-14',
    echeance: '2027-10-14',
    dureeMois: 12,
    tauxBp: 500,
    interetsAttendus: 50_000,
    penaliteBp: 5000,
    ...o,
  }
}

beforeEach(() => {
  etat.institution = { nom: 'IMCEC Test', adresse: '', telephone: '', numero_agrement: '' }
})

afterEach(() => vi.useRealTimers())

const exemplaires = (conteneur: HTMLElement) =>
  Array.from(conteneur.querySelectorAll('section[aria-label]')) as HTMLElement[]
const texteDe = (element: HTMLElement) => element.innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('CertificatDepotATerme', () => {
  it('contient le contrat : capital, départ, échéance, durée, taux, intérêts, pénalité, clause', () => {
    render(<CertificatDepotATerme {...bon()} />)
    const client = exemplaires(document.body)[0]!
    const u = within(client)

    expect(u.getByText('Bon de dépôt à terme')).toBeInTheDocument()
    expect(u.getByText('Bon n° DT-2026-0000007')).toBeInTheDocument()
    expect(u.getByText('Diallo Amadou')).toBeInTheDocument()
    expect(u.getByText('Souley Awa')).toBeInTheDocument()
    expect(u.getByText('Journée comptable : 14/10/2026')).toBeInTheDocument()
    const texte = texteDe(client)
    expect(texte).toContain('Départ 14/10/2026')
    expect(texte).toContain('Échéance 14/10/2027')
    expect(texte).toContain('Durée 12 mois')
    expect(texte).toContain('Taux annuel 5 %')
    expect(texte).toContain('Intérêts attendus à l’échéance 50 000 F')
    expect(texte).toContain('Pénalité de retrait anticipé 50 % des intérêts courus')
    expect(texte).toContain('Capital placé 1 000 000 F')
    expect(texte).toContain('un million de francs CFA')
    expect(texte).toContain('le capital est toujours restitué en totalité')
    expect(texte).toContain('Les intérêts cessent de courir à l’échéance')
  })

  it('la date est celle du placement fournie, pas l’horloge du poste', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2031-03-09T10:00:00Z'))

    render(<CertificatDepotATerme {...bon()} />)

    expect(document.body.textContent).toContain('14/10/2026')
    expect(document.body.textContent).not.toContain('2031')
  })

  it('deux exemplaires, signature du client OBLIGATOIRE, document masqué à l’écran', () => {
    render(<CertificatDepotATerme {...bon()} />)

    expect(exemplaires(document.body)).toHaveLength(2)
    expect(document.body.textContent).toContain('Signature du client (obligatoire)')
    expect(document.body.textContent).not.toContain('(facultative)')
    const zone = document.querySelector('[data-document="bon"]')!
    expect(zone).toHaveClass('zone-impression', 'hidden', 'print:block')
  })

  it('inactif : jamais imprimé ; bandeau provisoire sans institution ; duplicata off par défaut', () => {
    etat.institution = { nom: '', adresse: '', telephone: '', numero_agrement: '' }
    const { rerender } = render(<CertificatDepotATerme {...bon({ actif: false })} />)

    const zone = document.querySelector('[data-document="bon"]')!
    expect(zone).toHaveClass('hidden')
    expect(zone).not.toHaveClass('print:block')
    expect(document.body.textContent).toContain('Document provisoire')
    expect(document.body.textContent).not.toContain('DUPLICATA')

    rerender(<CertificatDepotATerme {...bon({ duplicata: true })} />)
    expect(document.body.textContent).toContain('DUPLICATA')
  })
})
