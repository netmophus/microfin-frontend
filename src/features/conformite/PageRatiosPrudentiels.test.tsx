import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  chargerDetailRatio,
  chargerRatios,
  type RatioDetail,
  type RatioEvalue,
  type TableauRatios,
} from '@/features/conformite/api'
import { PageRatiosPrudentiels } from '@/features/conformite/PageRatiosPrudentiels'

/**
 * Ratios prudentiels. Point dur : un ratio « en attente » (actif = false) ne doit JAMAIS
 * ressembler à un résultat — aucun chiffre, aucun seuil, badge distinct. Les trois autres
 * états (conforme, non conforme, non calculable) restent distincts et sans chiffre inventé.
 */

vi.mock('@/features/conformite/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/conformite/api')>(
    '@/features/conformite/api',
  )
  return { ...reel, chargerRatios: vi.fn(), chargerDetailRatio: vi.fn() }
})

const chargerRatiosSimule = vi.mocked(chargerRatios)
const chargerDetailSimule = vi.mocked(chargerDetailRatio)

function ratio(o: Partial<RatioEvalue> = {}): RatioEvalue {
  return {
    code: 'R1',
    libelle: 'Ratio test',
    reference_reglementaire: '010-08-2010',
    operateur: 'GE',
    seuil_applicable: '15.00',
    valeur_numerateur: 30,
    valeur_denominateur: 100,
    valeur_ratio_pct: '30.00',
    conforme: true,
    marge: '15.00',
    statut: 'CONFORME',
    actif: true,
    avertissements: [],
    ...o,
  }
}

function tableau(ratios: RatioEvalue[], o: Partial<TableauRatios> = {}): TableauRatios {
  return { aucune_ecriture_validee: false, ratios, ...o }
}

const EN_ATTENTE = ratio({
  code: 'R9',
  libelle: 'Ratio en attente test',
  seuil_applicable: null,
  valeur_numerateur: null,
  valeur_denominateur: null,
  valeur_ratio_pct: null,
  conforme: null,
  marge: null,
  statut: 'NON_CALCULABLE',
  actif: false,
})

function detail(o: Partial<RatioDetail> = {}): RatioDetail {
  return {
    ...ratio(),
    agregat_numerateur: {
      code: 'FP',
      libelle: 'Fonds propres test',
      type: 'BALANCE',
      valeur: 30,
      composants: [{ prefixe_compte: '10', sens: 1, solde: 30, contribution: 30 }],
      complement_provisions_tutelle_applique: null,
    },
    agregat_denominateur: {
      code: 'RISQ',
      libelle: 'Risques test',
      type: 'BALANCE',
      valeur: 100,
      composants: [{ prefixe_compte: '25', sens: 1, solde: 100, contribution: 100 }],
      complement_provisions_tutelle_applique: null,
    },
    ...o,
  }
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PageRatiosPrudentiels />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PageRatiosPrudentiels', () => {
  it('conforme : valeur, seuil et marge affichés', async () => {
    chargerRatiosSimule.mockResolvedValue(tableau([ratio()]))
    afficher()

    const ligne = (await screen.findByText('Ratio test')).closest('tr')!
    expect(within(ligne).getByText('≥ 15,00 %')).toBeVisible()
    expect(within(ligne).getByText('30,00 %')).toBeVisible()
    expect(within(ligne).getByText('Conforme')).toBeVisible()
    expect(within(ligne).getByText('Marge de 15,00 pt')).toBeVisible()
  })

  it('non conforme : écart affiché en valeur absolue, avec la mention textuelle', async () => {
    chargerRatiosSimule.mockResolvedValue(tableau([
      ratio({ valeur_ratio_pct: '10.00', conforme: false, marge: '-5.00', statut: 'NON_CONFORME' }),
    ]))
    afficher()

    const ligne = (await screen.findByText('Ratio test')).closest('tr')!
    expect(within(ligne).getByText('Non conforme')).toBeVisible()
    expect(within(ligne).getByText('Écart de 5,00 pt')).toBeVisible()
  })

  it('en attente : aucun chiffre, aucun seuil, badge distinct — jamais un faux résultat', async () => {
    chargerRatiosSimule.mockResolvedValue(tableau([ratio(), EN_ATTENTE]))
    afficher()

    const ligne = (await screen.findByText('Ratio en attente test')).closest('tr')!
    expect(within(ligne).getByText('En attente')).toBeVisible()
    expect(within(ligne).getByText('Non activé')).toBeVisible()
    expect(within(ligne).queryByText(/%/)).toBeNull()
    expect(within(ligne).queryByText('Conforme')).toBeNull()
    expect(within(ligne).queryByText('Non conforme')).toBeNull()
  })

  it('non calculable : aucune valeur, motif explicite', async () => {
    chargerRatiosSimule.mockResolvedValue(tableau([
      ratio({
        valeur_denominateur: 0,
        valeur_ratio_pct: null,
        conforme: null,
        marge: null,
        statut: 'NON_CALCULABLE',
      }),
      ratio({ code: 'R2', libelle: 'Autre ratio' }),
    ]))
    afficher()

    const ligne = (await screen.findByText('Ratio test')).closest('tr')!
    expect(within(ligne).getByText('Non calculable')).toBeVisible()
    expect(within(ligne).getByText('Dénominateur nul')).toBeVisible()
    // Cellules : référence, seuil (conservé), valeur (vide).
    expect(within(ligne).getAllByRole('cell')[2]).toHaveTextContent('—')
  })

  it('base vide : bandeau levé par l’indicateur global de l’API', async () => {
    chargerRatiosSimule.mockResolvedValue(
      tableau(
        [ratio({ valeur_ratio_pct: null, conforme: null, marge: null, statut: 'NON_CALCULABLE' })],
        { aucune_ecriture_validee: true },
      ),
    )
    afficher()

    expect(await screen.findByText(/Aucune écriture validée à cette date/)).toBeVisible()
  })

  it('base peu active : pas de bandeau « aucune écriture » quand des écritures existent', async () => {
    chargerRatiosSimule.mockResolvedValue(
      tableau([ratio({ valeur_ratio_pct: null, statut: 'NON_CALCULABLE' })]),
    )
    afficher()

    await screen.findByText('Ratio test')
    expect(screen.queryByText(/Aucune écriture validée à cette date/)).toBeNull()
  })

  it('conforme FRANC (sans avertissement) : vert plein, aucun point d’attention', async () => {
    chargerRatiosSimule.mockResolvedValue(tableau([ratio()]))
    afficher()

    const ligne = (await screen.findByText('Ratio test')).closest('tr')!
    const badge = within(ligne).getByText('Conforme').closest('span')!
    expect(badge).not.toHaveClass('bg-success-subtle/40')
    expect(within(ligne).queryByRole('list', { name: 'Points d’attention' })).toBeNull()
    expect(within(ligne).queryByText(/avec point d’attention/)).toBeNull()
  })

  it('conforme AVEC avertissement : vert atténué, icône, texte — le statut reste « Conforme »', async () => {
    chargerRatiosSimule.mockResolvedValue(
      tableau([
        ratio({
          valeur_ratio_pct: '0.00',
          marge: '200.00',
          avertissements: [
            { code: 'NUMERATEUR_NUL', libelle: 'Aucun risque porté à cette date' },
            { code: 'FONDS_PROPRES_NULS', libelle: 'Aucun fonds propres enregistré à cette date' },
          ],
        }),
      ]),
    )
    afficher()

    const ligne = (await screen.findByText('Ratio test')).closest('tr')!
    const badge = within(ligne).getByText('Conforme').closest('span')!
    expect(badge).toHaveClass('bg-success-subtle/40')
    expect(within(ligne).getByText('Aucun risque porté à cette date')).toBeVisible()
    expect(within(ligne).getByText('Aucun fonds propres enregistré à cette date')).toBeVisible()
    // Information jamais portée par la couleur seule : mention pour lecteurs d’écran.
    expect(within(ligne).getByText(/avec point d’attention/)).toBeInTheDocument()
    expect(within(ligne).getByText('0,00 %')).toBeVisible() // la valeur n’est pas masquée
  })

  it('le détail rappelle les avertissements du ratio', async () => {
    chargerRatiosSimule.mockResolvedValue(tableau([ratio()]))
    chargerDetailSimule.mockResolvedValue(
      detail({ avertissements: [{ code: 'NUMERATEUR_NUL', libelle: 'Aucun risque porté à cette date' }] }),
    )
    afficher()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Voir le détail du ratio Ratio test' }),
    )
    const panneau = await screen.findByRole('region', { name: 'Détail du ratio' })
    expect(await within(panneau).findByText('Aucun risque porté à cette date')).toBeVisible()
  })

  it('la date de référence est affichée en évidence', async () => {
    chargerRatiosSimule.mockResolvedValue(tableau([ratio()]))
    afficher()

    expect(await screen.findByText(/Données arrêtées au \d{2}\/\d{2}\/\d{4}/)).toBeVisible()
  })

  it('clic sur un ratio : décomposition du numérateur et du dénominateur', async () => {
    chargerRatiosSimule.mockResolvedValue(tableau([ratio()]))
    chargerDetailSimule.mockResolvedValue(detail())
    afficher()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Voir le détail du ratio Ratio test' }),
    )

    const panneau = await screen.findByRole('region', { name: 'Détail du ratio' })
    expect(await within(panneau).findByText('Fonds propres test')).toBeVisible()
    expect(within(panneau).getByText('Risques test')).toBeVisible()
    expect(within(panneau).getByText('10')).toBeVisible()
    expect(within(panneau).getByText('25')).toBeVisible()
    expect(chargerDetailSimule).toHaveBeenCalledWith('R1', expect.any(String))
  })

  it('détail : les comptes à solde nul sont masqués par défaut, affichables à la demande', async () => {
    chargerRatiosSimule.mockResolvedValue(tableau([ratio()]))
    const base = detail()
    chargerDetailSimule.mockResolvedValue({
      ...base,
      agregat_numerateur: {
        ...base.agregat_numerateur,
        composants: [
          { prefixe_compte: '10', sens: 1, solde: 30, contribution: 30 },
          { prefixe_compte: '99', sens: -1, solde: 0, contribution: 0 },
        ],
      },
    })
    afficher()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Voir le détail du ratio Ratio test' }),
    )
    const panneau = await screen.findByRole('region', { name: 'Détail du ratio' })
    expect(await within(panneau).findByText('10')).toBeVisible()
    expect(within(panneau).queryByText('99')).toBeNull()

    await userEvent.click(
      within(panneau).getByRole('button', { name: 'Afficher les 1 compte(s) à solde nul' }),
    )
    expect(within(panneau).getByText('99')).toBeVisible()
  })

  it('détail d’un ratio en attente : avertit que ce n’est pas un résultat réglementaire', async () => {
    chargerRatiosSimule.mockResolvedValue(tableau([EN_ATTENTE]))
    chargerDetailSimule.mockResolvedValue(detail({ code: 'R9', actif: false }))
    afficher()

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Voir le détail du ratio Ratio en attente test',
      }),
    )

    expect(await screen.findByText(/ne constitue pas un résultat réglementaire/)).toBeVisible()
  })

  it('détail : un agrégat sans composition paramétrée n’est pas présenté comme une règle dédiée', async () => {
    chargerRatiosSimule.mockResolvedValue(tableau([EN_ATTENTE]))
    const base = detail({ code: 'R9', actif: false })
    chargerDetailSimule.mockResolvedValue({
      ...base,
      agregat_denominateur: { ...base.agregat_denominateur, composants: [], valeur: 0 },
    })
    afficher()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Voir le détail du ratio Ratio en attente test' }),
    )
    expect(await screen.findByText(/sa composition n’est pas paramétrée/)).toBeVisible()
    expect(screen.queryByText(/règle dédiée/)).toBeNull()
  })

  it('erreur API : message clair et bouton Réessayer qui relance', async () => {
    chargerRatiosSimule.mockRejectedValueOnce(new Error('boom'))
    chargerRatiosSimule.mockResolvedValue(tableau([ratio()]))
    afficher()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Impossible de calculer les ratios prudentiels.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByText('Ratio test')).toBeVisible()
  })

  it('aucun ratio paramétré : état vide avec explication', async () => {
    chargerRatiosSimule.mockResolvedValue(tableau([]))
    afficher()

    expect(await screen.findByText(/Aucun ratio prudentiel n’est paramétré/)).toBeVisible()
  })
})
