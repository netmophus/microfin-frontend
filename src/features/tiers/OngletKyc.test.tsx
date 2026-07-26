import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { IndividuDetail } from '@/features/tiers/api'
import { mettreAJourKyc } from '@/features/tiers/kyc'
import { OngletKyc } from '@/features/tiers/OngletKyc'

/**
 * Onglet KYC — la pièce qui bouchait le trou (backend prêt, aucun écran de saisie). Points durs :
 * le badge de risque marque clairement le barème PROVISOIRE, et la saisie déclenche le recalcul.
 */

const etat = vi.hoisted(() => ({ permissions: ['tiers.update'] as string[] }))

vi.mock('@/features/auth/useProfil', () => ({
  useProfil: () => ({ data: { permissions: etat.permissions } }),
  useAPermission: (p: string) => etat.permissions.includes(p),
}))
vi.mock('@/features/tiers/kyc', () => ({ mettreAJourKyc: vi.fn().mockResolvedValue({}) }))
vi.mock('@/features/tiers/referentiels', () => ({
  listerSecteurs: vi.fn().mockResolvedValue([{ id: 's1', code: 'AGRI', libelle: 'Agriculture' }]),
}))

const majSimule = vi.mocked(mettreAJourKyc)

const INDIVIDU: IndividuDetail = {
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
  profession: null,
  monthly_income_estimate: null,
  is_literate: true,
  origine_fonds: null,
  secteur_activite_id: null,
  ppe_status: false,
  ppe_relation: null,
  ppe_fonction: null,
  mode_entree_relation: null,
}

function afficher(props: Partial<Parameters<typeof OngletKyc>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <OngletKyc
        tierId="t1"
        individu={INDIVIDU}
        riskLevel={props.riskLevel ?? null}
        riskProvisional={props.riskProvisional ?? false}
      />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.permissions = ['tiers.update']
})

describe('OngletKyc', () => {
  it('le badge de risque marque clairement le barème PROVISOIRE', () => {
    afficher({ riskLevel: 'eleve', riskProvisional: true })

    expect(screen.getByText('Élevé')).toBeVisible()
    // L'avertissement doit dire que ce n'est PAS une valeur réglementaire confirmée.
    expect(screen.getByText(/PROVISOIRE/)).toBeVisible()
    expect(screen.getByText(/pas une valeur réglementaire confirmée/i)).toBeVisible()
  })

  it('renseigner et enregistrer déclenche la mise à jour KYC', async () => {
    afficher()
    fireEvent.change(screen.getByLabelText('Origine des fonds'), { target: { value: 'Salaire' } })
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer et recalculer/ }))

    await waitFor(() =>
      expect(majSimule).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({ origine_fonds: 'Salaire' }),
      ),
    )
  })

  it('sans tiers.update, la saisie est en lecture seule (aucun bouton d’enregistrement)', () => {
    etat.permissions = ['tiers.read'] // ex. auditeur
    afficher({ riskLevel: 'faible' })

    expect(screen.queryByRole('button', { name: /Enregistrer/ })).toBeNull()
  })
})
