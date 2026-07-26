import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ajouterTelephone,
  ErreurTelephone,
  listerContacts,
  type Contact,
} from '@/features/tiers/coordonnees'
import { OngletCoordonnees } from '@/features/tiers/OngletCoordonnees'

/**
 * Onglet Coordonnées — le point dur : l'échappatoire du téléphone.
 * « Enregistrer quand même » n'apparaît QUE sur un refus forcable=true (numéro de bonne forme,
 * non reconnu). Sur du charabia (forcable=false), le bouton ne doit JAMAIS apparaître.
 */

const etat = vi.hoisted(() => ({ permissions: ['tiers.update'] as string[] }))

vi.mock('@/features/auth/useProfil', () => ({
  useProfil: () => ({ data: { permissions: etat.permissions } }),
  useAPermission: (p: string) => etat.permissions.includes(p),
}))

vi.mock('@/features/tiers/coordonnees', async () => {
  const reel = await vi.importActual<typeof import('@/features/tiers/coordonnees')>(
    '@/features/tiers/coordonnees',
  )
  return {
    ...reel, // garde les classes d'erreur réelles (ErreurTelephone) pour l'instanceof du composant
    listerContacts: vi.fn(),
    ajouterTelephone: vi.fn(),
    ajouterEmail: vi.fn(),
    ajouterAdresse: vi.fn(),
    definirPrincipalContact: vi.fn(),
    supprimerContact: vi.fn(),
  }
})

const listerSimule = vi.mocked(listerContacts)
const ajoutSimule = vi.mocked(ajouterTelephone)
const ID = '11111111-1111-1111-1111-111111111111'

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <OngletCoordonnees tierId={ID} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.permissions = ['tiers.update']
})

async function ouvrirEtSoumettreTelephone() {
  await screen.findByText('Téléphones')
  fireEvent.click(screen.getByRole('button', { name: /Ajouter un téléphone/ }))
  fireEvent.change(screen.getByLabelText('Numéro de téléphone'), { target: { value: '999999999999' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))
}

describe('OngletCoordonnees — échappatoire téléphone', () => {
  it('un refus forcable propose « Enregistrer quand même »', async () => {
    listerSimule.mockResolvedValue([])
    ajoutSimule.mockRejectedValue(new ErreurTelephone('Ce numéro ne semble pas valide.', true))

    afficher()
    await ouvrirEtSoumettreTelephone()

    expect(await screen.findByText('Ce numéro ne semble pas valide.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Enregistrer quand même' })).toBeVisible()
  })

  it('un refus NON forcable (charabia) ne propose jamais « Enregistrer quand même »', async () => {
    listerSimule.mockResolvedValue([])
    ajoutSimule.mockRejectedValue(new ErreurTelephone('Ce numéro ne semble pas valide.', false))

    afficher()
    await ouvrirEtSoumettreTelephone()

    expect(await screen.findByText('Ce numéro ne semble pas valide.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Enregistrer quand même' })).toBeNull()
  })
})

describe('OngletCoordonnees — adresse', () => {
  it('les deux modes (rue ET repère) sont proposés d’égale importance', async () => {
    listerSimule.mockResolvedValue([])

    afficher()
    await screen.findByText('Adresses')
    fireEvent.click(screen.getByRole('button', { name: /Ajouter une adresse/ }))

    // Le repère n'est pas une option cachée : les deux champs sont là d'emblée.
    expect(screen.getByLabelText('Rue / voie')).toBeVisible()
    expect(screen.getByLabelText('Point de repère')).toBeVisible()
  })

  it('un numéro forcé est signalé « non vérifié » dans la liste', async () => {
    const force: Contact = {
      id: 'c1',
      contact_type: 'phone',
      contact_subtype: 'mobile',
      is_primary: true,
      is_verified: false,
      phone_number: '+227999999999999',
      phone_raw: '999999999999',
      phone_country_code: 'NE',
      phone_normalized: false, // forcé
      email_address: null,
      address_line1: null,
      address_line2: null,
      quarter: null,
      landmark: null,
      city_id: null,
      region_id: null,
      country_id: null,
      postal_code: null,
    }
    listerSimule.mockResolvedValue([force])

    afficher()

    expect(await screen.findByText('Numéro non vérifié')).toBeVisible()
  })
})
