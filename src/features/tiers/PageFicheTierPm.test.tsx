import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ErreurModification,
  lireTier,
  lireTimeline,
  modifierGroupement,
  modifierPersonneMorale,
  type FicheTier,
} from '@/features/tiers/api'
import { listerTypesPieces } from '@/features/tiers/pieces'
import { PageFicheTier } from '@/features/tiers/PageFicheTier'

/**
 * Fiche d'une personne morale ou d'un groupement : tous les champs du profil (pays et devise par
 * leur NOM, jamais un identifiant), édition réservée à tiers.update avec le refus du serveur
 * affiché tel quel, et sélecteur de pièces filtré par type de fiche.
 */

const etat = vi.hoisted(() => ({ permissions: [] as string[] }))

vi.mock('@/features/auth/useProfil', () => ({
  useProfil: () => ({ data: { permissions: etat.permissions } }),
  useAPermission: (p: string) => etat.permissions.includes(p),
}))
vi.mock('@/features/tiers/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/tiers/api')>('@/features/tiers/api')
  return {
    ...reel,
    lireTier: vi.fn(),
    lireTimeline: vi.fn(),
    modifierPersonneMorale: vi.fn(),
    modifierGroupement: vi.fn(),
  }
})
vi.mock('@/features/utilisateurs/agences', () => ({
  listerAgences: vi.fn().mockResolvedValue([{ id: 'a1', code: 'AG1', name: 'Agence Centre' }]),
}))
vi.mock('@/features/tiers/coordonnees', () => ({
  listerContacts: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/features/tiers/pieces', () => ({
  listerPieces: vi.fn().mockResolvedValue([]),
  listerTypesPieces: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/features/tiers/referentiels', () => ({
  listerPays: vi.fn().mockResolvedValue([
    { id: 'pays-sn', code: 'SN', name: 'Sénégal' },
    { id: 'pays-ne', code: 'NE', name: 'Niger' },
  ]),
  listerDevises: vi
    .fn()
    .mockResolvedValue([{ id: 'dev-xof', code: 'XOF', name: 'Franc CFA', decimal_places: 0 }]),
  listerSecteurs: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/features/tiers/personnesLiees', async () => {
  const reel = await vi.importActual<typeof import('@/features/tiers/personnesLiees')>(
    '@/features/tiers/personnesLiees',
  )
  return {
    ...reel,
    listerPersonnesLiees: vi.fn().mockResolvedValue({
      items: [],
      journee_reference: '2026-10-12',
      total_beneficiaires: '0',
      seuil: null,
      seuil_provisoire: false,
      risque: { niveau: null, explication: '', origine: null, provisoire: true },
    }),
  }
})
vi.mock('@/features/tiers/kyc', () => ({
  lireConditionsActivation: vi.fn().mockResolvedValue({ activable: true, conditions: [] }),
  mettreAJourKyc: vi.fn(),
}))

const lireSimule = vi.mocked(lireTier)
const modifierPmSimule = vi.mocked(modifierPersonneMorale)
const modifierGroupementSimule = vi.mocked(modifierGroupement)
const typesSimule = vi.mocked(listerTypesPieces)
const ID = '22222222-2222-2222-2222-222222222222'

function afficher() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/tiers/${ID}`]}>
        <Routes>
          <Route path="/tiers/:id" element={<PageFicheTier />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const BASE = {
  id: ID,
  status: 'prospect',
  is_member: false,
  primary_agency_id: 'a1',
  primary_phone: '',
  created_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
}

const SOCIETE: FicheTier = {
  ...BASE,
  tier_number: 'M-2026-0000010',
  tier_type: 'legal_entity',
  personne_morale: {
    legal_name: 'TANDA SERVICES',
    commercial_name: 'Tanda',
    legal_form: 'SARL',
    rccm_number: 'NI-NIA-2020-B-0042',
    nif_number: 'NIF-123',
    constitution_date: '2020-03-15',
    capital_amount: '5000000.00',
    capital_currency_id: 'dev-xof',
    business_purpose: 'Négoce de céréales',
    headquarters_country_id: 'pays-ne',
  },
}

const GROUPEMENT: FicheTier = {
  ...BASE,
  tier_number: 'M-2026-0000011',
  tier_type: 'group',
  groupement: {
    group_name: 'HASKE',
    group_type: 'tontine',
    constitution_date: '2019-06-01',
    intervention_zone: 'Commune de Tahoua',
    group_purpose: 'Épargne et entraide',
    expected_member_count: 25,
  },
}

const INDIVIDU: FicheTier = {
  ...BASE,
  tier_number: 'M-2026-0000012',
  tier_type: 'individual',
  individu: {
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
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.permissions = ['tiers.read', 'tiers.read.basic']
  vi.mocked(lireTimeline).mockResolvedValue([])
})

describe('fiche d’une personne morale', () => {
  it('affiche les neuf champs du profil, pays et devise par leur nom', async () => {
    lireSimule.mockResolvedValue(SOCIETE)

    afficher()

    expect(await screen.findByText('Tanda')).toBeVisible() // nom commercial
    expect(screen.getByText('SARL — Société à responsabilité limitée')).toBeVisible()
    expect(screen.getByText('NI-NIA-2020-B-0042')).toBeVisible()
    expect(screen.getByText('NIF-123')).toBeVisible()
    expect(screen.getByText('15/03/2020')).toBeVisible()
    expect(await screen.findByText('Niger')).toBeVisible() // siège : le nom, pas 'pays-ne'
    expect(await screen.findByText(/5\s?000\s?000\s?XOF/)).toBeVisible()
    expect(screen.getByText('Négoce de céréales')).toBeVisible()
    expect(screen.queryByText('pays-ne')).toBeNull()
    expect(screen.queryByText('dev-xof')).toBeNull()
  })

  it('un champ non renseigné s’affiche par un tiret, pas par une valeur inventée', async () => {
    lireSimule.mockResolvedValue({
      ...SOCIETE,
      personne_morale: {
        ...SOCIETE.personne_morale!,
        commercial_name: null,
        rccm_number: null,
        nif_number: null,
        capital_amount: null,
        capital_currency_id: null,
        business_purpose: null,
      },
    })

    afficher()
    await screen.findByText('TANDA SERVICES')

    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(5)
  })

  it('la pièce à ajouter se choisit parmi les types applicables aux sociétés', async () => {
    lireSimule.mockResolvedValue(SOCIETE)
    typesSimule.mockResolvedValue([])

    afficher()
    await screen.findByText('TANDA SERVICES')
    fireEvent.click(screen.getByRole('tab', { name: /Pièces/ }))

    await waitFor(() => expect(typesSimule).toHaveBeenCalledWith('legal_entity'))
  })
})

describe('fiche d’un groupement', () => {
  it('affiche les champs du profil du groupement', async () => {
    lireSimule.mockResolvedValue(GROUPEMENT)

    afficher()

    expect((await screen.findAllByText('HASKE')).length).toBeGreaterThan(0)
    expect(screen.getByText('Tontine')).toBeVisible()
    expect(screen.getByText('01/06/2019')).toBeVisible()
    expect(screen.getByText('Commune de Tahoua')).toBeVisible()
    expect(screen.getByText('Épargne et entraide')).toBeVisible()
    expect(screen.getByText('25 membres')).toBeVisible()
  })
})

describe('édition du profil', () => {
  it('le bouton Modifier n’existe que pour tiers.update', async () => {
    lireSimule.mockResolvedValue(SOCIETE)

    afficher()
    await screen.findByText('TANDA SERVICES')

    expect(screen.queryByRole('button', { name: 'Modifier' })).toBeNull()
  })

  it('pas de bouton Modifier sur une personne physique (elle a son onglet KYC)', async () => {
    etat.permissions = ['tiers.read', 'tiers.read.basic', 'tiers.update']
    lireSimule.mockResolvedValue(INDIVIDU)

    afficher()
    await screen.findByText('Diallo Amadou')

    expect(screen.queryByRole('button', { name: 'Modifier' })).toBeNull()
  })

  it('pas de bouton Modifier sur une fiche désactivée', async () => {
    etat.permissions = ['tiers.read', 'tiers.read.basic', 'tiers.update']
    lireSimule.mockResolvedValue({ ...SOCIETE, status: 'desactive' })

    afficher()
    await screen.findByText('TANDA SERVICES')

    expect(screen.queryByRole('button', { name: 'Modifier' })).toBeNull()
  })

  it('une société se modifie : formulaire prérempli, envoi de tous les champs', async () => {
    etat.permissions = ['tiers.read', 'tiers.read.basic', 'tiers.update']
    lireSimule.mockResolvedValue(SOCIETE)
    modifierPmSimule.mockResolvedValue(SOCIETE)

    afficher()
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }))

    expect(screen.getByLabelText('Dénomination sociale')).toHaveValue('TANDA SERVICES')
    expect(screen.getByLabelText('Numéro RCCM (facultatif)')).toHaveValue('NI-NIA-2020-B-0042')
    fireEvent.change(screen.getByLabelText('Numéro RCCM (facultatif)'), {
      target: { value: 'NI-NIA-2020-B-0099' },
    })
    fireEvent.change(screen.getByLabelText('NIF (facultatif)'), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }))

    await waitFor(() => expect(modifierPmSimule).toHaveBeenCalledTimes(1))
    expect(modifierPmSimule).toHaveBeenCalledWith(ID, {
      legal_name: 'TANDA SERVICES',
      commercial_name: 'Tanda',
      legal_form: 'SARL',
      rccm_number: 'NI-NIA-2020-B-0099',
      nif_number: null, // vidé : envoyé comme absence de valeur
      constitution_date: '2020-03-15',
      capital_amount: '5000000.00',
      capital_currency_id: 'dev-xof',
      business_purpose: 'Négoce de céréales',
      headquarters_country_id: 'pays-ne',
    })
    // Succès : le formulaire se referme.
    await waitFor(() => expect(screen.queryByLabelText('Dénomination sociale')).toBeNull())
  })

  it('un RCCM déjà pris est refusé avec le message du serveur, le formulaire reste ouvert', async () => {
    etat.permissions = ['tiers.read', 'tiers.read.basic', 'tiers.update']
    lireSimule.mockResolvedValue(SOCIETE)
    modifierPmSimule.mockRejectedValue(
      new ErreurModification('Ce numéro RCCM est déjà rattaché à une autre fiche.'),
    )

    afficher()
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }))

    expect(await screen.findByText('Ce numéro RCCM est déjà rattaché à une autre fiche.')).toBeVisible()
    expect(screen.getByLabelText('Dénomination sociale')).toBeVisible()
  })

  it('un refus sans message exploitable donne un message d’erreur en langage métier', async () => {
    etat.permissions = ['tiers.read', 'tiers.read.basic', 'tiers.update']
    lireSimule.mockResolvedValue(SOCIETE)
    modifierPmSimule.mockRejectedValue(new ErreurModification(null))

    afficher()
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }))

    expect(await screen.findByText(/Impossible d’enregistrer les modifications\./)).toBeVisible()
  })

  it('un champ obligatoire vidé est signalé sous le champ, rien n’est envoyé', async () => {
    etat.permissions = ['tiers.read', 'tiers.read.basic', 'tiers.update']
    lireSimule.mockResolvedValue(SOCIETE)

    afficher()
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }))
    fireEvent.change(screen.getByLabelText('Dénomination sociale'), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }))

    expect(await screen.findByText('Ce champ est obligatoire.')).toBeVisible()
    expect(modifierPmSimule).not.toHaveBeenCalled()
  })

  it('Annuler referme le formulaire sans rien envoyer', async () => {
    etat.permissions = ['tiers.read', 'tiers.read.basic', 'tiers.update']
    lireSimule.mockResolvedValue(SOCIETE)

    afficher()
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }))
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(screen.queryByLabelText('Dénomination sociale')).toBeNull()
    expect(modifierPmSimule).not.toHaveBeenCalled()
  })

  it('un groupement se modifie : l’effectif part en nombre, le champ vidé en absence', async () => {
    etat.permissions = ['tiers.read', 'tiers.read.basic', 'tiers.update']
    lireSimule.mockResolvedValue(GROUPEMENT)
    modifierGroupementSimule.mockResolvedValue(GROUPEMENT)

    afficher()
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }))
    fireEvent.change(screen.getByLabelText('Effectif prévu (facultatif)'), {
      target: { value: '30' },
    })
    fireEvent.change(screen.getByLabelText('Zone d’intervention (facultatif)'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }))

    await waitFor(() => expect(modifierGroupementSimule).toHaveBeenCalledTimes(1))
    expect(modifierGroupementSimule).toHaveBeenCalledWith(ID, {
      group_name: 'HASKE',
      group_type: 'tontine',
      constitution_date: '2019-06-01',
      intervention_zone: null,
      group_purpose: 'Épargne et entraide',
      expected_member_count: 30,
    })
  })
})

describe('onglets d’une société ou d’un groupement', () => {
  it('une société a les onglets Personnes liées et KYC / Risque (risque hérité)', async () => {
    lireSimule.mockResolvedValue(SOCIETE)

    afficher()
    await screen.findByText('TANDA SERVICES')
    fireEvent.click(screen.getByRole('tab', { name: 'KYC / Risque' }))

    expect(screen.getByRole('tab', { name: 'Personnes liées' })).toBeVisible()
    expect(await screen.findByText(/Niveau non évalué/)).toBeVisible()
    expect(screen.queryByText(/Connaissance client/)).toBeNull() // le KYC de personne physique
  })

  it('un groupement a aussi l’onglet Personnes liées', async () => {
    lireSimule.mockResolvedValue(GROUPEMENT)

    afficher()
    await screen.findAllByText('HASKE')
    fireEvent.click(screen.getByRole('tab', { name: 'Personnes liées' }))

    expect(await screen.findByText('Aucune personne liée n’est enregistrée.')).toBeVisible()
  })

  it('une personne physique n’a pas d’onglet Personnes liées', async () => {
    lireSimule.mockResolvedValue(INDIVIDU)

    afficher()
    await screen.findByText('Diallo Amadou')

    expect(screen.queryByRole('tab', { name: 'Personnes liées' })).toBeNull()
    expect(screen.getByRole('tab', { name: 'KYC / Risque' })).toBeVisible()
  })
})
