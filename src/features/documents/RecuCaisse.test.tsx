import { render, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RecuCaisse, type PropsRecu } from '@/features/documents/RecuCaisse'

/**
 * Reçu de caisse imprimable. Points durs : toutes les données viennent de l'opération (n° de pièce
 * = n° de reçu, date = JOURNÉE COMPTABLE fournie, jamais l'horloge), deux exemplaires, blocs de
 * signature (client obligatoire ou facultative), bandeau provisoire tant que l'institution n'est
 * pas configurée, document masqué à l'écran et imprimé seulement sur le papier.
 */

const etat = vi.hoisted(() => ({
  institution: {
    nom: 'IMCEC Test',
    adresse: 'Rue de la Caisse, Niamey',
    telephone: '+227 20 00 00 00',
    numero_agrement: 'AGR-001',
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

function recu(o: Partial<PropsRecu> = {}): PropsRecu {
  return {
    titre: 'Reçu de versement',
    numeroPiece: 'CA-2026-000123',
    dateComptable: '2026-10-14',
    membre: 'Traoré Fatoumata',
    compte: 'EP-2026-0000001',
    libelleMontant: 'Montant versé',
    montantPrincipal: 2_000_000,
    soldeApres: 2_017_000,
    signatureClientRequise: false,
    ...o,
  }
}

beforeEach(() => {
  etat.institution = {
    nom: 'IMCEC Test',
    adresse: 'Rue de la Caisse, Niamey',
    telephone: '+227 20 00 00 00',
    numero_agrement: 'AGR-001',
  }
})

afterEach(() => vi.useRealTimers())

function exemplairesDe(conteneur: HTMLElement) {
  return Array.from(conteneur.querySelectorAll('section[aria-label]')) as HTMLElement[]
}

function exemplaires(conteneur: HTMLElement) {
  return Array.from(conteneur.querySelectorAll('section[aria-label]')) as HTMLElement[]
}

describe('RecuCaisse', () => {
  it('contient institution, agence, n° de pièce, date comptable, caissier, membre, compte et montants', () => {
    render(<RecuCaisse {...recu()} />)
    const client = exemplaires(document.body)[0]!

    const u = within(client)
    expect(u.getByText('IMCEC Test')).toBeInTheDocument()
    expect(u.getByText('Rue de la Caisse, Niamey')).toBeInTheDocument()
    expect(u.getByText('Tél. : +227 20 00 00 00')).toBeInTheDocument()
    expect(u.getByText('Agrément n° AGR-001')).toBeInTheDocument()
    expect(u.getByText('Agence : Siège (AG-001)')).toBeInTheDocument()
    expect(u.getByText('Journée comptable : 14/10/2026')).toBeInTheDocument()
    expect(u.getByText('Reçu n° CA-2026-000123')).toBeInTheDocument()
    expect(u.getByText('Souley Awa')).toBeInTheDocument()
    expect(u.getByText('Traoré Fatoumata')).toBeInTheDocument()
    expect(u.getByText('EP-2026-0000001')).toBeInTheDocument()
    expect(u.getByText('Montant versé')).toBeInTheDocument()
    expect(u.getByText('2 000 000 F')).toBeInTheDocument()
    expect(u.getByText('Nouveau solde')).toBeInTheDocument()
    expect(u.getByText('2 017 000 F')).toBeInTheDocument()
    expect(u.getByText('Arrêté à la somme de : deux millions de francs CFA.')).toBeInTheDocument()
  })

  it('la date affichée est la journée comptable fournie, PAS l’horloge du poste', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2031-03-09T10:00:00Z'))

    render(<RecuCaisse {...recu({ dateComptable: '2026-10-14' })} />)

    expect(document.body.textContent).toContain('14/10/2026')
    expect(document.body.textContent).not.toContain('09/03/2031')
    expect(document.body.textContent).not.toContain('2031')
  })

  it('deux exemplaires : client et souche, chacun complet', () => {
    render(<RecuCaisse {...recu()} />)

    const [client, souche] = exemplaires(document.body)
    expect(exemplaires(document.body)).toHaveLength(2)
    expect(within(client!).getByText('Exemplaire client')).toBeInTheDocument()
    expect(within(souche!).getByText('Exemplaire souche')).toBeInTheDocument()
    for (const exemplaire of [client!, souche!]) {
      expect(within(exemplaire).getByText('Reçu n° CA-2026-000123')).toBeInTheDocument()
      expect(within(exemplaire).getByText('Signature du caissier')).toBeInTheDocument()
    }
  })

  it('signature du client : obligatoire pour un retrait, facultative pour un versement', () => {
    const { rerender } = render(<RecuCaisse {...recu({ signatureClientRequise: true })} />)
    expect(document.body.textContent).toContain('Signature du client (obligatoire)')
    expect(document.body.textContent).not.toContain('Signature du client (facultative)')

    rerender(<RecuCaisse {...recu({ signatureClientRequise: false })} />)
    expect(document.body.textContent).toContain('Signature du client (facultative)')
    expect(document.body.textContent).not.toContain('(obligatoire)')
  })

  it('masqué à l’écran, imprimé sur le papier : classes du patron d’impression', () => {
    render(<RecuCaisse {...recu()} />)
    const zone = document.querySelector('[data-document="recu"]')!

    expect(zone).toHaveClass('zone-impression', 'hidden', 'print:block')
  })

  it('document inactif : jamais imprimé (deux documents sur un écran, un seul part)', () => {
    render(<RecuCaisse {...recu({ actif: false })} />)
    const zone = document.querySelector('[data-document="recu"]')!

    expect(zone).toHaveClass('hidden')
    expect(zone).not.toHaveClass('print:block')
  })

  it('bandeau « provisoire » tant que l’institution n’est pas configurée', () => {
    etat.institution = { nom: '', adresse: '', telephone: '', numero_agrement: '' }

    render(<RecuCaisse {...recu()} />)

    expect(document.body.textContent).toContain(
      'Document provisoire — en-tête et mentions à valider avant déploiement.',
    )
    expect(document.body.textContent).toContain('Nom de l’institution (à renseigner)')
  })

  it('pas de bandeau provisoire quand l’institution est configurée', () => {
    render(<RecuCaisse {...recu()} />)

    expect(document.body.textContent).not.toContain('Document provisoire')
  })

  it('duplicata : désactivé par défaut, marqué quand on l’active', () => {
    const { rerender } = render(<RecuCaisse {...recu()} />)
    expect(document.body.textContent).not.toContain('DUPLICATA')

    rerender(<RecuCaisse {...recu({ duplicata: true })} />)
    expect(document.body.textContent).toContain('DUPLICATA')
  })

  it('lignes de détail et nouveau solde absent quand non fourni (cas du dénouement)', () => {
    render(
      <RecuCaisse
        {...recu({
          titre: 'Reçu de retrait anticipé — dépôt à terme',
          libelleMontant: 'Total remis au client',
          montantPrincipal: 1_009_000,
          soldeApres: null,
          lignes: [
            { libelle: 'Capital', valeur: '1 000 000 F' },
            { libelle: 'Intérêts courus', valeur: '18 000 F' },
            { libelle: 'Pénalité de retrait anticipé', valeur: '9 000 F' },
          ],
          signatureClientRequise: true,
        })}
      />,
    )
    const client = exemplaires(document.body)[0]!

    expect(within(client).getByText('Pénalité de retrait anticipé')).toBeInTheDocument()
    expect(within(client).getByText('9 000 F')).toBeInTheDocument()
    expect(within(client).getByText('1 009 000 F')).toBeInTheDocument()
    expect(within(client).queryByText('Nouveau solde')).toBeNull()
    expect(
      within(client).getByText('Arrêté à la somme de : un million neuf mille francs CFA.'),
    ).toBeInTheDocument()
  })

  it('un seul trait de découpe, ENTRE les deux exemplaires, visible seulement à l’impression', () => {
    render(<RecuCaisse {...recu()} />)
    const zone = document.querySelector('[data-document="recu"]')!

    const traits = within(zone as HTMLElement).getAllByTestId('trait-decoupe')
    expect(traits).toHaveLength(1)
    expect(traits[0]).toHaveTextContent('✂ découper ici')
    expect(traits[0]).toHaveClass('hidden', 'print:block', 'border-dashed')
    // Ordre dans le document : exemplaire client, trait, exemplaire souche — rien avant ni après.
    const enfants = Array.from(zone.children)
    expect(enfants).toHaveLength(3)
    expect(enfants[0]).toHaveAttribute('aria-label', 'Exemplaire client')
    expect(enfants[1]).toBe(traits[0])
    expect(enfants[2]).toHaveAttribute('aria-label', 'Exemplaire souche')
  })

  it('chaque exemplaire évite la coupure de page, aucun saut de page forcé', () => {
    render(<RecuCaisse {...recu()} />)
    const zone = document.querySelector('[data-document="recu"]')!

    for (const exemplaire of exemplairesDe(zone as HTMLElement)) {
      expect(exemplaire).toHaveClass('exemplaire', 'print:break-inside-avoid')
    }
    expect(zone.innerHTML).not.toMatch(/break-(before|after)|page-break/)
  })

  it('classes d’impression intactes, document monté sous <body> hors de l’application', () => {
    const { container } = render(<RecuCaisse {...recu()} />)
    const zone = document.querySelector('[data-document="recu"]')!

    expect(zone).toHaveClass('zone-impression', 'piece-imprimable', 'hidden', 'print:block')
    expect(container.contains(zone)).toBe(false) // portail : ne dépend pas de la hauteur de l’appli
    expect(zone.parentElement).toBe(document.body)
  })

  it('l’application est retirée de l’impression tant qu’une pièce est active, puis rétablie', () => {
    const racine = document.documentElement
    const { rerender, unmount } = render(<RecuCaisse {...recu()} />)
    expect(racine).toHaveClass('impression-piece')

    rerender(<RecuCaisse {...recu({ actif: false })} />)
    expect(racine).not.toHaveClass('impression-piece')

    rerender(<RecuCaisse {...recu({ actif: true })} />)
    expect(racine).toHaveClass('impression-piece')
    unmount()
    expect(racine).not.toHaveClass('impression-piece')
  })
})
