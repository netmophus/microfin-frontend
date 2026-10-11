import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { lireTier, type FicheTier } from '@/features/tiers/api'
import { OngletPersonnesLiees } from '@/features/tiers/OngletPersonnesLiees'
import {
  ajouterPersonneLiee,
  ErreurLien,
  listerPersonnesLiees,
  modifierPersonneLiee,
  rechercherPersonnes,
  retirerPersonneLiee,
  type LienPersonne,
  type PersonnesLiees,
} from '@/features/tiers/personnesLiees'

/**
 * Onglet « Personnes liées » : ce que l'agent doit voir (qui agit pour la société, qui la détient,
 * depuis quand), séparer (bénéficiaires effectifs et leur total), et pouvoir faire (ajouter,
 * modifier, retirer avec motif) — avec les quatre états et les refus du serveur affichés tels quels.
 */

const etat = vi.hoisted(() => ({ permissions: ['tiers.read', 'tiers.update'] as string[] }))

vi.mock('@/features/auth/useProfil', () => ({
  useProfil: () => ({ data: { permissions: etat.permissions } }),
  useAPermission: (p: string) => etat.permissions.includes(p),
}))
vi.mock('@/features/tiers/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/tiers/api')>('@/features/tiers/api')
  return { ...reel, lireTier: vi.fn() }
})
vi.mock('@/features/tiers/personnesLiees', async () => {
  const reel = await vi.importActual<typeof import('@/features/tiers/personnesLiees')>(
    '@/features/tiers/personnesLiees',
  )
  return {
    ...reel,
    listerPersonnesLiees: vi.fn(),
    ajouterPersonneLiee: vi.fn(),
    modifierPersonneLiee: vi.fn(),
    retirerPersonneLiee: vi.fn(),
    rechercherPersonnes: vi.fn(),
  }
})

const listerSimule = vi.mocked(listerPersonnesLiees)
const ajouterSimule = vi.mocked(ajouterPersonneLiee)
const modifierSimule = vi.mocked(modifierPersonneLiee)
const retirerSimule = vi.mocked(retirerPersonneLiee)
const rechercherSimule = vi.mocked(rechercherPersonnes)
const lireTierSimule = vi.mocked(lireTier)
const PM = '33333333-3333-3333-3333-333333333333'

function lien(over: Partial<LienPersonne>): LienPersonne {
  return {
    id: 'l1',
    individual_tier_id: 'p1',
    nom: 'BOUBACAR Idrissa',
    tier_number: 'M-2026-0000001',
    statut: 'actif',
    niveau_risque: 'faible',
    role: 'representant_legal',
    fonction: 'Gérant',
    pourcentage_detention: null,
    pouvoir_signature: true,
    date_debut: '2024-01-15',
    date_fin: null,
    en_cours: true,
    atteint_le_seuil: false,
    ...over,
  }
}

function vue(items: LienPersonne[], over: Partial<PersonnesLiees> = {}): PersonnesLiees {
  return {
    items,
    journee_reference: '2026-10-12',
    total_beneficiaires: '0',
    seuil: '25.00',
    seuil_provisoire: true,
    risque: { niveau: 'faible', explication: 'Faible', origine: null, provisoire: true },
    ...over,
  }
}

const COMPLETE = vue(
  [
    lien({}),
    lien({
      id: 'l2',
      individual_tier_id: 'p2',
      nom: 'TRAORE Awa',
      tier_number: 'M-2026-0000002',
      role: 'beneficiaire_effectif',
      fonction: null,
      pourcentage_detention: '60.00',
      pouvoir_signature: false,
      atteint_le_seuil: true,
    }),
    lien({
      id: 'l3',
      individual_tier_id: 'p3',
      nom: 'MAIGA Sani',
      tier_number: 'M-2026-0000003',
      role: 'beneficiaire_effectif',
      fonction: null,
      pourcentage_detention: '30.00',
      pouvoir_signature: false,
    }),
    lien({
      id: 'l4',
      individual_tier_id: 'p4',
      nom: 'DIALLO Oumar',
      tier_number: 'M-2026-0000004',
      role: 'dirigeant',
      date_debut: '2020-02-01',
      date_fin: '2023-12-31',
      en_cours: false,
    }),
  ],
  { total_beneficiaires: '90.00' },
)

function afficher(tierType = 'legal_entity', personneInitiale: string | null = null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <OngletPersonnesLiees tierId={PM} tierType={tierType} personneInitiale={personneInitiale} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.permissions = ['tiers.read', 'tiers.update']
})

describe('états de l’onglet', () => {
  it('chargement : un message de chargement, pas un écran vide', () => {
    listerSimule.mockReturnValue(new Promise(() => undefined))

    afficher()

    expect(screen.getByText('Chargement des personnes liées…')).toBeVisible()
  })

  it('erreur : message métier et bouton Réessayer qui relance la lecture', async () => {
    listerSimule.mockRejectedValueOnce(new Error('réseau'))
    listerSimule.mockResolvedValue(vue([lien({})]))

    afficher()
    expect(await screen.findByText('Impossible de charger les personnes liées.')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByText('BOUBACAR Idrissa')).toBeVisible()
    expect(listerSimule).toHaveBeenCalledTimes(2)
  })

  it('vide : dit ce qui manque, pourquoi, et propose l’action', async () => {
    listerSimule.mockResolvedValue(vue([]))

    afficher()

    expect(await screen.findByText('Aucune personne liée n’est enregistrée.')).toBeVisible()
    expect(screen.getByText(/enregistrez au moins son représentant légal/)).toBeVisible()
    expect(screen.getByRole('button', { name: /Ajouter une personne liée/ })).toBeVisible()
  })

  it('partiel : sans seuil paramétré, la liste s’affiche avec un bandeau', async () => {
    listerSimule.mockResolvedValue(vue([lien({})], { seuil: null, seuil_provisoire: false }))

    afficher()

    expect(await screen.findByText('BOUBACAR Idrissa')).toBeVisible()
    expect(screen.getByText(/seuil de bénéficiaire effectif n’est pas paramétré/)).toBeVisible()
  })
})

describe('affichage', () => {
  it('liste les personnes liées avec rôle, fonction, signature et date de début', async () => {
    listerSimule.mockResolvedValue(COMPLETE)

    afficher()

    const ligne = (await screen.findByText('BOUBACAR Idrissa')).closest('tr')!
    expect(within(ligne).getByText('Représentant légal')).toBeVisible()
    expect(within(ligne).getByText('Gérant')).toBeVisible()
    expect(within(ligne).getByText('Oui')).toBeVisible()
    expect(within(ligne).getByText('15/01/2024')).toBeVisible()
    expect(screen.getByRole('link', { name: 'BOUBACAR Idrissa' })).toHaveAttribute('href', '/tiers/p1')
  })

  it('sépare les bénéficiaires effectifs, avec leur total et le seuil provisoire', async () => {
    listerSimule.mockResolvedValue(COMPLETE)

    afficher()
    const section = (await screen.findByRole('heading', { name: 'Bénéficiaires effectifs' })).closest(
      'section',
    )!

    expect(within(section).getByText('TRAORE Awa')).toBeVisible()
    expect(within(section).getByText('MAIGA Sani')).toBeVisible()
    expect(within(section).queryByText('BOUBACAR Idrissa')).toBeNull() // l'autre section
    expect(within(section).getByText(/Détention cumulée/)).toHaveTextContent('90 %')
    expect(within(section).getByText(/Seuil de bénéficiaire effectif/)).toHaveTextContent('25 % (provisoire)')
    // Le seuil signale, il ne bloque rien : seule la ligne qui l'atteint porte la mention.
    expect(within(section).getAllByText('Seuil atteint')).toHaveLength(1)
  })

  it('un mandat terminé est rangé à part, avec sa date de fin', async () => {
    listerSimule.mockResolvedValue(COMPLETE)

    afficher()
    const section = (await screen.findByRole('heading', { name: 'Mandats terminés' })).closest('section')!

    expect(within(section).getByText('DIALLO Oumar')).toBeVisible()
    expect(within(section).getByText('31/12/2023')).toBeVisible()
    expect(within(section).queryByRole('button', { name: /Modifier/ })).toBeNull()
  })

  it('un groupement n’a pas de section bénéficiaires effectifs', async () => {
    listerSimule.mockResolvedValue(vue([lien({ role: 'membre_bureau' })]))

    afficher('group')

    expect(await screen.findByText('BOUBACAR Idrissa')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Bénéficiaires effectifs' })).toBeNull()
  })

  it('sans tiers.update : lecture seule, aucune action d’écriture', async () => {
    etat.permissions = ['tiers.read']
    listerSimule.mockResolvedValue(COMPLETE)

    afficher()
    await screen.findByText('BOUBACAR Idrissa')

    expect(screen.queryByRole('button', { name: /Ajouter une personne liée/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Modifier/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Retirer/ })).toBeNull()
  })
})

describe('ajout', () => {
  async function ouvrirEtChoisir() {
    listerSimule.mockResolvedValue(vue([]))
    rechercherSimule.mockResolvedValue([
      {
        id: 'p9',
        tier_number: 'M-2026-0000009',
        tier_type: 'individual',
        display_name: 'BOUBACAR Idrissa',
        status: 'prospect',
        is_member: false,
        primary_agency_id: 'a1',
      },
    ])
    afficher()
    fireEvent.click(await screen.findByRole('button', { name: /Ajouter une personne liée/ }))
    fireEvent.change(screen.getByLabelText(/Rechercher une personne physique/), {
      target: { value: 'bouba' },
    })
    fireEvent.click(await screen.findByRole('button', { name: /BOUBACAR Idrissa/ }))
  }

  it('cherche une personne physique, la choisit, et propose la création d’une nouvelle', async () => {
    await ouvrirEtChoisir()

    expect(rechercherSimule).toHaveBeenCalledWith('bouba')
    expect(screen.getByText(/Personne choisie/)).toHaveTextContent('BOUBACAR Idrissa')
  })

  it('le lien de création renvoie vers la fiche d’où l’on vient', async () => {
    listerSimule.mockResolvedValue(vue([]))
    afficher()
    fireEvent.click(await screen.findByRole('button', { name: /Ajouter une personne liée/ }))

    expect(screen.getByRole('link', { name: 'Créer une nouvelle personne physique' })).toHaveAttribute(
      'href',
      `/tiers/nouveau?retour=${PM}`,
    )
  })

  it('la date de début est proposée à la journée comptable, requise, modifiable', async () => {
    await ouvrirEtChoisir()

    const debut = screen.getByLabelText('Date de début du mandat (obligatoire)')
    expect(debut).toHaveValue('2026-10-12')
    expect(debut).toBeRequired()
    fireEvent.change(debut, { target: { value: '2024-01-15' } })
    expect(debut).toHaveValue('2024-01-15')
  })

  it('envoie le lien : représentant légal avec la date de début saisie', async () => {
    ajouterSimule.mockResolvedValue(COMPLETE)
    await ouvrirEtChoisir()

    fireEvent.change(screen.getByLabelText('Rôle'), { target: { value: 'representant_legal' } })
    fireEvent.change(screen.getByLabelText('Fonction (facultatif)'), { target: { value: 'Gérant' } })
    fireEvent.click(screen.getByLabelText('Pouvoir de signature'))
    fireEvent.change(screen.getByLabelText('Date de début du mandat (obligatoire)'), {
      target: { value: '2024-01-15' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(ajouterSimule).toHaveBeenCalledTimes(1))
    expect(ajouterSimule).toHaveBeenCalledWith(PM, {
      individual_tier_id: 'p9',
      role: 'representant_legal',
      fonction: 'Gérant',
      pourcentage_detention: null,
      pouvoir_signature: true,
      date_debut: '2024-01-15',
      date_fin: null,
    })
  })

  it('un bénéficiaire effectif exige son pourcentage', async () => {
    await ouvrirEtChoisir()

    fireEvent.change(screen.getByLabelText('Rôle'), { target: { value: 'beneficiaire_effectif' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Indiquez un pourcentage entre 0 et 100.')).toBeVisible()
    expect(ajouterSimule).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Pourcentage de détention (obligatoire)'), {
      target: { value: '40' },
    })
    ajouterSimule.mockResolvedValue(COMPLETE)
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(ajouterSimule).toHaveBeenCalledTimes(1))
    expect(ajouterSimule).toHaveBeenCalledWith(
      PM,
      expect.objectContaining({ role: 'beneficiaire_effectif', pourcentage_detention: '40' }),
    )
  })

  it('une date de début vidée est refusée avant tout envoi', async () => {
    await ouvrirEtChoisir()

    fireEvent.change(screen.getByLabelText('Rôle'), { target: { value: 'dirigeant' } })
    fireEvent.change(screen.getByLabelText('Date de début du mandat (obligatoire)'), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Indiquez la date de début du mandat.')).toBeVisible()
    expect(ajouterSimule).not.toHaveBeenCalled()
  })

  it('le choix du rôle est obligatoire', async () => {
    await ouvrirEtChoisir()

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Choisissez un rôle.')).toBeVisible()
    expect(ajouterSimule).not.toHaveBeenCalled()
  })

  it('le refus du serveur s’affiche tel quel et le formulaire reste ouvert', async () => {
    ajouterSimule.mockRejectedValue(new ErreurLien('La somme des pourcentages de détention dépasse 100 %.'))
    await ouvrirEtChoisir()

    fireEvent.change(screen.getByLabelText('Rôle'), { target: { value: 'beneficiaire_effectif' } })
    fireEvent.change(screen.getByLabelText('Pourcentage de détention (obligatoire)'), {
      target: { value: '70' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('La somme des pourcentages de détention dépasse 100 %.')).toBeVisible()
    expect(screen.getByLabelText('Rôle')).toBeVisible()
  })

  it('un groupement ne propose pas le rôle bénéficiaire effectif', async () => {
    listerSimule.mockResolvedValue(vue([]))
    afficher('group')
    fireEvent.click(await screen.findByRole('button', { name: /Ajouter une personne liée/ }))

    const options = within(screen.getByLabelText('Rôle')).getAllByRole('option')
    expect(options.map((o) => o.textContent)).not.toContain('Bénéficiaire effectif')
    expect(options.map((o) => o.textContent)).toContain('Membre du bureau')
  })

  it('au retour de la création, la personne arrive déjà choisie', async () => {
    listerSimule.mockResolvedValue(vue([]))
    lireTierSimule.mockResolvedValue({
      id: 'p-neuve',
      individu: { last_name: 'NEUVE', first_name: 'Aïcha' },
    } as unknown as FicheTier)

    afficher('legal_entity', 'p-neuve')

    expect(await screen.findByText(/Personne choisie/)).toHaveTextContent('NEUVE Aïcha')
    expect(screen.getByLabelText('Rôle')).toBeVisible()
  })
})

describe('modification et retrait', () => {
  it('modifie un lien : seuls les champs du formulaire partent', async () => {
    listerSimule.mockResolvedValue(vue([lien({})]))
    modifierSimule.mockResolvedValue(vue([lien({})]))

    afficher()
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier BOUBACAR Idrissa' }))
    fireEvent.change(screen.getByLabelText('Fonction (facultatif)'), { target: { value: 'Directeur' } })
    fireEvent.change(screen.getByLabelText('Date de fin (facultatif)'), { target: { value: '2026-12-31' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(modifierSimule).toHaveBeenCalledTimes(1))
    expect(modifierSimule).toHaveBeenCalledWith(PM, 'l1', {
      fonction: 'Directeur',
      pouvoir_signature: true,
      date_debut: '2024-01-15',
      date_fin: '2026-12-31',
    })
  })

  it('une date de fin avant le début est refusée avant tout envoi', async () => {
    listerSimule.mockResolvedValue(vue([lien({})]))

    afficher()
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier BOUBACAR Idrissa' }))
    fireEvent.change(screen.getByLabelText('Date de fin (facultatif)'), { target: { value: '2023-01-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('La date de fin ne peut pas précéder la date de début.')).toBeVisible()
    expect(modifierSimule).not.toHaveBeenCalled()
  })

  it('retire un lien : rappel de ce qui est affecté, motif obligatoire, puis confirmation', async () => {
    listerSimule.mockResolvedValue(vue([lien({})]))
    retirerSimule.mockResolvedValue(vue([]))

    afficher()
    fireEvent.click(await screen.findByRole('button', { name: 'Retirer BOUBACAR Idrissa' }))

    expect(screen.getByText(/Retirer cette personne \?/)).toHaveTextContent('Représentant légal')
    expect(screen.getByText(/conservé dans l’historique, avec le motif/)).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le retrait' }))
    expect(await screen.findByText('Indiquez le motif du retrait.')).toBeVisible()
    expect(retirerSimule).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Motif du retrait (obligatoire)'), {
      target: { value: ' Fin de mandat ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le retrait' }))

    await waitFor(() => expect(retirerSimule).toHaveBeenCalledWith(PM, 'l1', 'Fin de mandat'))
  })

  it('le refus de retirer le dernier représentant légal est affiché tel quel', async () => {
    listerSimule.mockResolvedValue(vue([lien({})]))
    retirerSimule.mockRejectedValue(
      new ErreurLien(
        'Une fiche active doit garder un représentant légal : ajoutez-en un autre avant de terminer ou retirer celui-ci.',
      ),
    )

    afficher()
    fireEvent.click(await screen.findByRole('button', { name: 'Retirer BOUBACAR Idrissa' }))
    fireEvent.change(screen.getByLabelText('Motif du retrait (obligatoire)'), {
      target: { value: 'Démission' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le retrait' }))

    expect(await screen.findByText(/doit garder un représentant légal/)).toBeVisible()
  })
})
