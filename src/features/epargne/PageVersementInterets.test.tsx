import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError, AxiosHeaders } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  listerProduitsInterets,
  previsualiserInterets,
  proposerPeriodeInterets,
  verserInterets,
  type PeriodeProposee,
  type ProduitInterets,
} from '@/features/epargne/api'
import { PageVersementInterets } from '@/features/epargne/PageVersementInterets'

/**
 * Écran de versement des intérêts. Points durs : la PRÉVISUALISATION obligatoire montre le total
 * ET le détail (taux visible) sans rien verser ; le versement exige une confirmation renforcée ;
 * une période déjà versée est DITE clairement (pas d'échec silencieux). La période n'est jamais
 * saisie : elle est PROPOSÉE d'après la périodicité du produit et verrouillée.
 */

vi.mock('@/features/epargne/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/epargne/api')>(
    '@/features/epargne/api',
  )
  return {
    ...reel,
    listerProduitsInterets: vi.fn(),
    proposerPeriodeInterets: vi.fn(),
    previsualiserInterets: vi.fn(),
    verserInterets: vi.fn(),
  }
})

const produitsSimules = vi.mocked(listerProduitsInterets)
const periodeSimulee = vi.mocked(proposerPeriodeInterets)
const apercuSimule = vi.mocked(previsualiserInterets)
const versementSimule = vi.mocked(verserInterets)

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PageVersementInterets />
    </QueryClientProvider>,
  )
}

const MENSUEL: ProduitInterets = {
  id: 'prod-mensuel',
  code: 'EPM',
  name: 'Épargne à vue',
  periodicite: 'mensuelle',
}
const ANNUEL: ProduitInterets = {
  id: 'prod-annuel',
  code: 'EPA',
  name: 'Épargne projet',
  periodicite: 'annuelle',
}
const PERIODE_MARS: PeriodeProposee = {
  periodicite: 'mensuelle',
  periode: '2026-03',
  debut: '2026-03-01',
  fin: '2026-03-31',
  journee_comptable: '2026-04-02',
}
const PERIODE_2025: PeriodeProposee = {
  periodicite: 'annuelle',
  periode: '2025',
  debut: '2025-01-01',
  fin: '2025-12-31',
  journee_comptable: '2026-04-02',
}

async function choisirProduit(nom: string) {
  fireEvent.change(await screen.findByLabelText('Produit'), {
    target: { value: nom === 'annuel' ? ANNUEL.id : MENSUEL.id },
  })
  await screen.findByText(/période (2026-03|2025),/)
}

async function remplirEtPrevisualiser() {
  await choisirProduit('mensuel')
  fireEvent.click(screen.getByRole('button', { name: 'Prévisualiser' }))
}

const apercuAvecComptes = {
  periode: '2026-03',
  debut: '2026-03-01',
  fin: '2026-03-31',
  jours: 31,
  comptes_actifs: 3,
  comptes_taux_zero: 0,
  comptes_a_crediter: 3,
  total: 45000,
  deja_traites: 0,
  deja_verse_le: null,
  en_erreur: [] as string[],
  echantillon: [
    {
      account_number: 'EP-2026-0000001',
      produit: 'Épargne à vue',
      taux_bp: 1000,
      methode: 'fin_periode',
      base_solde: 300000,
      montant: 15000,
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  produitsSimules.mockResolvedValue([MENSUEL, ANNUEL])
  periodeSimulee.mockImplementation(async (id) => (id === ANNUEL.id ? PERIODE_2025 : PERIODE_MARS))
})

describe('PageVersementInterets', () => {
  it('prévisualise : montre le total ET le détail (taux visible), sans rien verser', async () => {
    apercuSimule.mockResolvedValue(apercuAvecComptes)
    afficher()
    await remplirEtPrevisualiser()

    // Le résumé : X comptes, total Y F.
    expect(
      await screen.findByText(/3 comptes concernés, total à verser : 45 000 F/),
    ).toBeVisible()
    // Le DÉTAIL : le taux appliqué est visible (pas seulement le total).
    expect(screen.getByText('10 %')).toBeVisible()
    expect(screen.getByText('EP-2026-0000001')).toBeVisible()
    // Le barème est marqué PROVISOIRE.
    expect(screen.getByText(/Barème PROVISOIRE/)).toBeVisible()
    // Dry-run : aucun versement n'a été déclenché.
    expect(versementSimule).not.toHaveBeenCalled()
  })

  it('verser exige une confirmation renforcée, puis rend le résultat', async () => {
    apercuSimule.mockResolvedValue(apercuAvecComptes)
    versementSimule.mockResolvedValue({
      traites: 3,
      credites: 3,
      ignores: 0,
      total: 45000,
      en_erreur: [],
    })
    afficher()
    await remplirEtPrevisualiser()

    fireEvent.click(await screen.findByRole('button', { name: 'Verser les intérêts' }))
    // Confirmation renforcée : on énonce qu'on va créer de l'argent.
    expect(await screen.findByText(/Confirmer le versement des intérêts/)).toBeVisible()
    expect(screen.getByText(/Vous allez verser 45 000 F sur 3 comptes/)).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Verser les intérêts' }))
    await waitFor(() => expect(versementSimule).toHaveBeenCalledOnce())
    expect(await screen.findByText(/3 comptes crédités, pour un total de 45 000 F/)).toBeVisible()
  })

  it('période déjà versée : on le DIT clairement (pas d’échec silencieux)', async () => {
    apercuSimule.mockResolvedValue({
      ...apercuAvecComptes,
      comptes_a_crediter: 0,
      total: 0,
      deja_traites: 3,
      deja_verse_le: '2026-07-01T09:00:00Z',
      echantillon: [],
    })
    afficher()
    await remplirEtPrevisualiser()

    expect(await screen.findByText(/Intérêts déjà versés pour cette période/)).toBeVisible()
    // Pas de bouton de versement quand il n'y a rien à verser.
    expect(screen.queryByRole('button', { name: 'Verser les intérêts' })).toBeNull()
  })

  it('taux à 0 : rien à verser, mais l’écran DIT la raison (pas de silence)', async () => {
    apercuSimule.mockResolvedValue({
      ...apercuAvecComptes,
      comptes_actifs: 2,
      comptes_taux_zero: 2,
      comptes_a_crediter: 0,
      total: 0,
      deja_traites: 0,
      deja_verse_le: null,
      echantillon: [],
    })
    afficher()
    await remplirEtPrevisualiser()

    expect(await screen.findByText(/Aucun intérêt à verser sur cette période/)).toBeVisible()
    expect(screen.getByText(/produits d’épargne sont à taux 0/)).toBeVisible()
  })

  it('aperçu : les comptes en anomalie sont signalés avec leur message, les autres restent versables', async () => {
    const message = 'mouvement sans pièce comptable sur le compte EP-2026-0000002 : calcul impossible'
    apercuSimule.mockResolvedValue({ ...apercuAvecComptes, en_erreur: [message] })
    afficher()
    await remplirEtPrevisualiser()

    expect(await screen.findByText('1 compte non traité')).toBeVisible()
    expect(screen.getByText(message)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Verser les intérêts' })).toBeVisible()
  })

  it('aperçu : des comptes en anomalie sont signalés même quand rien n’est à verser', async () => {
    apercuSimule.mockResolvedValue({
      ...apercuAvecComptes,
      comptes_a_crediter: 0,
      total: 0,
      echantillon: [],
      en_erreur: ['anomalie sur le compte EP-1 : calcul impossible', 'anomalie sur le compte EP-2 : calcul impossible'],
    })
    afficher()
    await remplirEtPrevisualiser()

    expect(await screen.findByText('2 comptes non traités')).toBeVisible()
    expect(screen.getByText(/compte EP-1/)).toBeVisible()
    expect(screen.getByText(/compte EP-2/)).toBeVisible()
  })

  it('résultat du versement : les comptes non traités sont rappelés', async () => {
    const message = 'mouvement sans pièce comptable sur le compte EP-2026-0000002 : calcul impossible'
    apercuSimule.mockResolvedValue(apercuAvecComptes)
    versementSimule.mockResolvedValue({
      traites: 2,
      credites: 2,
      ignores: 0,
      total: 30000,
      en_erreur: [message],
    })
    afficher()
    await remplirEtPrevisualiser()
    fireEvent.click(await screen.findByRole('button', { name: 'Verser les intérêts' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Verser les intérêts' }))

    expect(await screen.findByText('1 compte non traité')).toBeVisible()
    expect(screen.getByText(message)).toBeVisible()
  })

  it('aucune anomalie : aucun bandeau de comptes non traités', async () => {
    apercuSimule.mockResolvedValue(apercuAvecComptes)
    afficher()
    await remplirEtPrevisualiser()

    await screen.findByText(/3 comptes concernés/)
    expect(screen.queryByText(/non traité/)).toBeNull()
  })

  it('champs incomplets : le clic n’est pas silencieux, on réclame la saisie', async () => {
    afficher()
    await screen.findByLabelText('Produit')
    // On clique SANS remplir : le bouton reste actif, mais explique ce qui manque.
    fireEvent.click(screen.getByRole('button', { name: 'Prévisualiser' }))

    expect(await screen.findByText(/Choisissez le produit avant de prévisualiser/)).toBeVisible()
    expect(apercuSimule).not.toHaveBeenCalled()
  })

  it('la période est proposée d’après la périodicité du produit et verrouillée', async () => {
    afficher()
    await choisirProduit('mensuel')

    expect(screen.getByText(/Mensuelle — période 2026-03, du 01\/03\/2026 au 31\/03\/2026/)).toBeVisible()
    expect(screen.getByText(/d’après la journée comptable du 02\/04\/2026/)).toBeVisible()
    expect(periodeSimulee).toHaveBeenCalledWith(MENSUEL.id)
    // Plus aucun champ de saisie de la période ni des dates.
    expect(screen.queryByLabelText('Période (libellé)')).toBeNull()
    expect(screen.queryByLabelText('Du')).toBeNull()
    expect(screen.queryByLabelText('Au')).toBeNull()
  })

  it('l’aperçu part avec le produit et la période proposée, jamais une saisie', async () => {
    apercuSimule.mockResolvedValue(apercuAvecComptes)
    afficher()
    await remplirEtPrevisualiser()

    await waitFor(() =>
      expect(apercuSimule).toHaveBeenCalledWith({
        product_id: MENSUEL.id,
        periode: '2026-03',
        debut: '2026-03-01',
        fin: '2026-03-31',
      }),
    )
  })

  it('changer de produit change la période proposée et efface l’aperçu', async () => {
    apercuSimule.mockResolvedValue(apercuAvecComptes)
    afficher()
    await remplirEtPrevisualiser()
    await screen.findByText(/3 comptes concernés/)

    await choisirProduit('annuel')

    expect(screen.getByText(/Annuelle — période 2025, du 01\/01\/2025 au 31\/12\/2025/)).toBeVisible()
    expect(screen.queryByText(/3 comptes concernés/)).toBeNull()
  })

  it('un refus de période par le serveur est affiché en langage métier', async () => {
    apercuSimule.mockRejectedValue(
      new AxiosError('refus', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 422,
        data: { detail: 'Ce produit verse ses intérêts chaque année.' },
        statusText: '',
        headers: {},
        config: { headers: new AxiosHeaders() },
      }),
    )
    afficher()
    await remplirEtPrevisualiser()

    expect(await screen.findByRole('alert')).toHaveTextContent(/chaque année/)
  })

  it('aucun produit actif : l’écran dit pourquoi', async () => {
    produitsSimules.mockResolvedValue([])
    afficher()

    expect(await screen.findByText(/Aucun produit d’épargne actif/)).toBeVisible()
  })

  it('produits indisponibles : message et bouton Réessayer', async () => {
    produitsSimules.mockRejectedValueOnce(new Error('réseau'))
    afficher()

    expect(await screen.findByText(/Impossible de charger les produits/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByLabelText('Produit')).toBeVisible()
  })
})
