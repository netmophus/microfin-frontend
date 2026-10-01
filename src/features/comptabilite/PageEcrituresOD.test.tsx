import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  contrePasserEcritureOD,
  creerEcritureOD,
  listerEcrituresOD,
  supprimerEcritureOD,
  validerEcritureOD,
  type EcritureODResume,
} from '@/features/comptabilite/api'
import { PageEcrituresOD } from '@/features/comptabilite/PageEcrituresOD'

/**
 * Saisie manuelle d'écriture OD (chantier P1, lot 1). Points durs : le journal n'est jamais
 * un champ du formulaire (imposé côté serveur) ; l'équilibre/le nombre de lignes affichés EN
 * DIRECT dans le formulaire utilisent les montants saisis, jamais un appel réseau ; « Valider »
 * se grise sur une pièce déséquilibrée ou à moins de 2 lignes (champs déjà fournis par l'API,
 * pas recalculés) ; « Supprimer »/« Contre-passer » exigent compta.ecriture.post/.reverse.
 */

const etat = vi.hoisted(() => ({
  permissions: ['compta.ecriture.read', 'compta.ecriture.post', 'compta.ecriture.reverse'] as string[],
}))

vi.mock('@/features/auth/useProfil', () => ({
  useAPermission: (p: string) => etat.permissions.includes(p),
}))

vi.mock('@/features/comptabilite/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/comptabilite/api')>(
    '@/features/comptabilite/api',
  )
  return {
    ...reel,
    listerEcrituresOD: vi.fn(),
    creerEcritureOD: vi.fn(),
    validerEcritureOD: vi.fn(),
    supprimerEcritureOD: vi.fn(),
    contrePasserEcritureOD: vi.fn(),
  }
})

vi.mock('@/components/comptabilite/selecteur-compte', () => ({
  SelecteurCompte: ({
    id,
    label,
    valeur,
    onChange,
  }: {
    id: string
    label: string
    valeur: string | null
    onChange: (v: string | null) => void
  }) => (
    <div>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={valeur ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      />
    </div>
  ),
}))

const listerSimule = vi.mocked(listerEcrituresOD)
const creerSimule = vi.mocked(creerEcritureOD)
const validerSimule = vi.mocked(validerEcritureOD)
const supprimerSimule = vi.mocked(supprimerEcritureOD)
const contrePasserSimule = vi.mocked(contrePasserEcritureOD)

function ecriture(o: Partial<EcritureODResume> = {}): EcritureODResume {
  return {
    id: 'e1',
    entry_number: null,
    entry_date: '2026-06-15',
    description: 'Régularisation test',
    status: 'brouillon',
    nb_lignes: 2,
    total_debit: 10000,
    total_credit: 10000,
    equilibree: true,
    est_contre_passation: false,
    deja_contre_passee: false,
    ...o,
  }
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PageEcrituresOD />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.permissions = ['compta.ecriture.read', 'compta.ecriture.post', 'compta.ecriture.reverse']
})

describe('PageEcrituresOD', () => {
  it('affiche la liste avec montants, numéro de pièce et badge de statut', async () => {
    listerSimule.mockResolvedValue({
      lignes: [ecriture({ id: 'e1', status: 'brouillon', entry_number: null })],
      total: 1,
      page: 1,
      taille: 50,
    })
    afficher()

    expect(await screen.findByText('Régularisation test')).toBeVisible()
    expect(screen.getByText('— brouillon —')).toBeVisible()
    expect(screen.getAllByText('10 000 F').length).toBeGreaterThan(0)
    expect(screen.getByText('Brouillon')).toBeVisible()
  })

  it('liste vide : message dédié, pas un tableau cassé', async () => {
    listerSimule.mockResolvedValue({ lignes: [], total: 0, page: 1, taille: 50 })
    afficher()

    expect(
      await screen.findByText('Aucune écriture dans le journal OD pour l’instant.'),
    ).toBeVisible()
  })

  it('erreur de chargement : message clair et bouton Réessayer', async () => {
    listerSimule.mockRejectedValue(new Error('échec réseau'))
    afficher()

    expect(
      await screen.findByText('Impossible de charger les écritures. Réessayez dans un instant.'),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeVisible()
  })

  it('403 : message dédié, pas de bouton Réessayer', async () => {
    listerSimule.mockRejectedValue(
      new AxiosError('interdit', undefined, undefined, undefined, { status: 403 } as never),
    )
    afficher()

    expect(
      await screen.findByText('Vous n’avez pas la permission de consulter ces écritures.'),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull()
  })

  it('« Valider » est grisé si déséquilibrée ou à moins de 2 lignes', async () => {
    listerSimule.mockResolvedValue({
      lignes: [
        ecriture({ id: 'e1', description: 'Déséquilibrée', equilibree: false, nb_lignes: 2 }),
        ecriture({ id: 'e2', description: 'Une seule ligne', equilibree: true, nb_lignes: 1 }),
      ],
      total: 2,
      page: 1,
      taille: 50,
    })
    afficher()

    await screen.findByText('Déséquilibrée')
    await screen.findByText('Une seule ligne')
    const boutonsValider = screen.getAllByRole('button', { name: 'Valider' })
    expect(boutonsValider[0]).toBeDisabled()
    expect(boutonsValider[1]).toBeDisabled()
  })

  it('bouton Valider absent sans compta.ecriture.post', async () => {
    etat.permissions = ['compta.ecriture.read']
    listerSimule.mockResolvedValue({ lignes: [ecriture()], total: 1, page: 1, taille: 50 })
    afficher()

    await screen.findByText('Régularisation test')
    expect(screen.queryByRole('button', { name: 'Valider' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Supprimer' })).toBeNull()
  })

  it('bouton Contre-passer absent sans compta.ecriture.reverse', async () => {
    etat.permissions = ['compta.ecriture.read', 'compta.ecriture.post']
    listerSimule.mockResolvedValue({
      lignes: [ecriture({ status: 'validee', entry_number: 'OD-2026-00001' })],
      total: 1,
      page: 1,
      taille: 50,
    })
    afficher()

    await screen.findByText('Régularisation test')
    expect(screen.queryByRole('button', { name: 'Contre-passer' })).toBeNull()
  })

  it('bouton Contre-passer absent si déjà contre-passée', async () => {
    listerSimule.mockResolvedValue({
      lignes: [
        ecriture({
          status: 'validee', entry_number: 'OD-2026-00001', deja_contre_passee: true,
        }),
      ],
      total: 1,
      page: 1,
      taille: 50,
    })
    afficher()

    await screen.findByText('Régularisation test')
    expect(screen.queryByRole('button', { name: 'Contre-passer' })).toBeNull()
    expect(screen.getByText('Contre-passée')).toBeVisible()
  })

  it('valide une pièce après confirmation', async () => {
    listerSimule.mockResolvedValue({ lignes: [ecriture()], total: 1, page: 1, taille: 50 })
    validerSimule.mockResolvedValue({ ...ecriture(), status: 'validee', lignes: [] })
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Valider' }))
    expect(
      await screen.findByText(/Elle deviendra immuable et numérotée/),
    ).toBeVisible()
    expect(validerSimule).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Valider' }))
    await waitFor(() => expect(validerSimule).toHaveBeenCalledWith('e1'))
  })

  it('supprime un brouillon après confirmation', async () => {
    listerSimule.mockResolvedValue({ lignes: [ecriture()], total: 1, page: 1, taille: 50 })
    supprimerSimule.mockResolvedValue(undefined)
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer' }))
    expect(await screen.findByText('Supprimer ce brouillon ?')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    await waitFor(() => expect(supprimerSimule).toHaveBeenCalledWith('e1'))
  })

  it('contre-passe une pièce validée après confirmation, nomme la pièce d’origine', async () => {
    listerSimule.mockResolvedValue({
      lignes: [ecriture({ status: 'validee', entry_number: 'OD-2026-00007' })],
      total: 1,
      page: 1,
      taille: 50,
    })
    contrePasserSimule.mockResolvedValue({ ...ecriture(), status: 'validee', lignes: [] })
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Contre-passer' }))
    expect(await screen.findByText(/OD-2026-00007/)).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Contre-passer' }))
    await waitFor(() => expect(contrePasserSimule).toHaveBeenCalledWith('e1'))
  })

  it('formulaire : totaux et équilibre en direct, sans appel réseau', async () => {
    listerSimule.mockResolvedValue({ lignes: [], total: 0, page: 1, taille: 50 })
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Nouvelle écriture OD' }))
    expect(await screen.findByText('Nouvelle écriture (journal OD)')).toBeVisible()

    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Test formulaire' },
    })
    fireEvent.change(screen.getByLabelText('Ligne 1'), { target: { value: '202211' } })
    const montants = screen.getAllByLabelText('Montant')
    fireEvent.change(montants[0]!, { target: { value: '5000' } })
    fireEvent.change(screen.getByLabelText('Ligne 2'), { target: { value: '101111' } })
    fireEvent.change(montants[1]!, { target: { value: '5000' } })

    // Les deux lignes sont par défaut en D : tout au débit (10 000), rien au crédit.
    expect(screen.getByText(/Déséquilibrée/)).toBeVisible()

    const sens = screen.getAllByLabelText('Sens')
    fireEvent.change(sens[1]!, { target: { value: 'C' } })
    expect(screen.getByText('Équilibrée')).toBeVisible()
    // Maintenant 5 000 F de chaque côté (débit et crédit).
    expect(screen.getAllByText('5 000 F').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }))
    await waitFor(() =>
      expect(creerSimule).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Test formulaire',
          lignes: [
            { account_number: '202211', side: 'D', amount: 5000, label: undefined },
            { account_number: '101111', side: 'C', amount: 5000, label: undefined },
          ],
        }),
      ),
    )
  })

  it('formulaire : Enregistrer reste grisé tant qu’une ligne ajoutée est incomplète', async () => {
    listerSimule.mockResolvedValue({ lignes: [], total: 0, page: 1, taille: 50 })
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Nouvelle écriture OD' }))
    fireEvent.change(await screen.findByLabelText('Description'), {
      target: { value: 'Incomplet' },
    })
    fireEvent.change(screen.getByLabelText('Ligne 1'), { target: { value: '202211' } })
    fireEvent.change(screen.getAllByLabelText('Montant')[0]!, { target: { value: '5000' } })
    // Ligne 2 jamais remplie.

    expect(screen.getByRole('button', { name: 'Enregistrer le brouillon' })).toBeDisabled()
  })

  it('formulaire : ajouter/retirer une ligne', async () => {
    listerSimule.mockResolvedValue({ lignes: [], total: 0, page: 1, taille: 50 })
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Nouvelle écriture OD' }))
    await screen.findByText('Nouvelle écriture (journal OD)')
    expect(screen.getAllByLabelText('Montant')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une ligne' }))
    expect(screen.getAllByLabelText('Montant')).toHaveLength(3)

    fireEvent.click(screen.getAllByLabelText('Retirer la ligne')[2]!)
    expect(screen.getAllByLabelText('Montant')).toHaveLength(2)
  })

  it('formulaire : annuler revient à la liste sans rien créer', async () => {
    listerSimule.mockResolvedValue({ lignes: [], total: 0, page: 1, taille: 50 })
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Nouvelle écriture OD' }))
    await screen.findByText('Nouvelle écriture (journal OD)')
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(await screen.findByText('Aucune écriture dans le journal OD pour l’instant.')).toBeVisible()
    expect(creerSimule).not.toHaveBeenCalled()
  })
})
