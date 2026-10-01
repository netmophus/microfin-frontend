import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  affecterResultat,
  cloturerExercice,
  genererANouveaux,
  listerExercices,
  previsualiserAffectation,
  previsualiserANouveaux,
  previsualiserCloture,
  type ApercuAffectation,
  type ApercuANouveaux,
  type ApercuCloture,
  type ExerciceResume,
} from '@/features/comptabilite/api'
import { PageExercices } from '@/features/comptabilite/PageExercices'

/**
 * Exercices comptables : clôture TECHNIQUE (lot b1), affectation du résultat (lot b2a),
 * à-nouveaux (lot b2b). Points durs : chaque action n'apparaît que dans son état propre
 * (« Clôturer » sur OUVERT, « Affecter le résultat »/« Générer les à-nouveaux » sur CLOS non
 * encore fait) ; l'aperçu (dry-run) est TOUJOURS affiché avant toute confirmation ; sur un
 * DÉFICIT, aucun champ de ventilation n'est proposé ; le bouton de génération des à-nouveaux se
 * grise si l'exercice suivant est absent ou pas ouvert, avec le motif affiché ; la confirmation
 * est un pas SÉPARÉ, explicite, pour chaque action.
 */

vi.mock('@/features/comptabilite/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/comptabilite/api')>(
    '@/features/comptabilite/api',
  )
  return {
    ...reel,
    listerExercices: vi.fn(),
    previsualiserCloture: vi.fn(),
    cloturerExercice: vi.fn(),
    previsualiserAffectation: vi.fn(),
    affecterResultat: vi.fn(),
    previsualiserANouveaux: vi.fn(),
    genererANouveaux: vi.fn(),
  }
})

const listerSimule = vi.mocked(listerExercices)
const apercuSimule = vi.mocked(previsualiserCloture)
const cloturerSimule = vi.mocked(cloturerExercice)
const apercuAffectationSimule = vi.mocked(previsualiserAffectation)
const affecterSimule = vi.mocked(affecterResultat)
const apercuANouveauxSimule = vi.mocked(previsualiserANouveaux)
const genererANouveauxSimule = vi.mocked(genererANouveaux)

function exercice(o: Partial<ExerciceResume> = {}): ExerciceResume {
  return {
    id: 'ex1',
    code: '2099',
    label: 'Exercice de test',
    date_debut: '2099-01-01',
    date_fin: '2099-12-31',
    status: 'ouvert',
    resultat_affecte: false,
    a_nouveaux_generes: false,
    ...o,
  }
}

function apercuANouveaux(o: Partial<ApercuANouveaux> = {}): ApercuANouveaux {
  return {
    exercice_source: exercice({ status: 'clos' }),
    exercice_suivant: exercice({ id: 'ex2', code: '2100', status: 'ouvert' }),
    lignes: [
      {
        account_number: '591',
        name: 'Excédent ou déficit en instance d’approbation',
        account_class: 5,
        side: 'C',
        amount: 10000,
      },
    ],
    total_debit: 10000,
    total_credit: 10000,
    equilibre: true,
    deja_genere: false,
    generable: true,
    ...o,
  }
}

function apercuAffectation(o: Partial<ApercuAffectation> = {}): ApercuAffectation {
  return {
    exercice: exercice({ status: 'clos' }),
    montant: 100000,
    deja_affecte: false,
    affectable: true,
    ...o,
  }
}

function apercu(o: Partial<ApercuCloture> = {}): ApercuCloture {
  return {
    exercice: exercice(),
    resultat: 12000,
    compte_resultat: '591',
    lignes: [
      {
        account_number: '7T960',
        name: 'Compte 7T960',
        account_class: 7,
        total_debit: 0,
        total_credit: 12000,
        side: 'D',
        amount: 12000,
      },
    ],
    brouillons_bloquants: [],
    cloturable: true,
    ...o,
  }
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PageExercices />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PageExercices', () => {
  it('affiche la liste avec code, période et statut', async () => {
    listerSimule.mockResolvedValue([exercice()])
    afficher()

    expect(await screen.findByText('2099')).toBeVisible()
    expect(screen.getByText('Ouvert')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Clôturer' })).toBeVisible()
  })

  it('liste vide : message dédié', async () => {
    listerSimule.mockResolvedValue([])
    afficher()

    expect(await screen.findByText('Aucun exercice n’a encore été ouvert.')).toBeVisible()
  })

  it('erreur de chargement : message et bouton Réessayer', async () => {
    listerSimule.mockRejectedValue(new Error('boom'))
    afficher()

    expect(
      await screen.findByText('Impossible de charger les exercices. Réessayez dans un instant.'),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeVisible()
  })

  it('un exercice CLOS n’a pas de bouton Clôturer', async () => {
    listerSimule.mockResolvedValue([exercice({ status: 'clos' })])
    afficher()

    expect(await screen.findByText('Clos')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Clôturer' })).not.toBeInTheDocument()
  })

  it('clic sur Clôturer ouvre l’aperçu avec le résultat et le détail', async () => {
    listerSimule.mockResolvedValue([exercice()])
    apercuSimule.mockResolvedValue(apercu())
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Clôturer' }))

    expect(await screen.findByText('Excédent : 12 000 F')).toBeVisible()
    expect(
      screen.getByText('Porté au compte 591 (résultat en instance d’approbation), en attente d’approbation.'),
    ).toBeVisible()
    expect(screen.getByText('7T960')).toBeVisible()
  })

  it('rien à clôturer : message dédié, pas de tableau de détail', async () => {
    listerSimule.mockResolvedValue([exercice()])
    apercuSimule.mockResolvedValue(apercu({ resultat: 0, lignes: [] }))
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Clôturer' }))

    expect(
      await screen.findByText('Aucun mouvement de charges ou de produits sur cet exercice : rien à clôturer.'),
    ).toBeVisible()
  })

  it('brouillons bloquants : le bouton Clôturer de l’aperçu disparaît', async () => {
    listerSimule.mockResolvedValue([exercice()])
    apercuSimule.mockResolvedValue(
      apercu({
        cloturable: false,
        brouillons_bloquants: [
          { entry_id: 'b1', journal_code: 'OD', entry_date: '2099-03-01', description: 'Oublié' },
        ],
      }),
    )
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Clôturer' }))

    expect(
      await screen.findByText(
        '1 brouillon(s) empêchent la clôture. Validez-les ou supprimez-les avant de continuer.',
      ),
    ).toBeVisible()
    expect(screen.getByText('Oublié')).toBeVisible()
    // Un seul bouton "Clôturer" dans tout l'écran : celui, déjà consommé, de la liste n'existe
    // plus (on est sur l'aperçu) ; celui de l'aperçu est absent puisque non cloturable.
    expect(screen.queryByRole('button', { name: 'Clôturer' })).not.toBeInTheDocument()
  })

  it('confirme puis exécute la clôture, affiche le résultat final', async () => {
    listerSimule.mockResolvedValue([exercice()])
    apercuSimule.mockResolvedValue(apercu())
    cloturerSimule.mockResolvedValue({
      exercice: exercice({ status: 'clos' }),
      entry_number: 'OD-2099-000001',
      resultat: 12000,
    })
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Clôturer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Clôturer' }))

    expect(
      await screen.findByText(/Clôturer l’exercice 2099 \? Cette action est DÉFINITIVE/),
    ).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la clôture' }))

    expect(await screen.findByText('Exercice 2099 clôturé — pièce OD-2099-000001.')).toBeVisible()
  })

  it('retour à la liste depuis l’aperçu', async () => {
    listerSimule.mockResolvedValue([exercice()])
    apercuSimule.mockResolvedValue(apercu())
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Clôturer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Retour à la liste' }))

    expect(await screen.findByText('Exercices comptables')).toBeVisible()
  })

  // --- Affectation du résultat (lot b2a) ---------------------------------------------------

  it('un exercice OUVERT n’a pas de bouton Affecter le résultat', async () => {
    listerSimule.mockResolvedValue([exercice()])
    afficher()

    expect(await screen.findByText('2099')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Affecter le résultat' }),
    ).not.toBeInTheDocument()
  })

  it('un exercice CLOS déjà affecté affiche le badge, pas de bouton', async () => {
    listerSimule.mockResolvedValue([exercice({ status: 'clos', resultat_affecte: true })])
    afficher()

    expect(await screen.findByText('Résultat affecté')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Affecter le résultat' }),
    ).not.toBeInTheDocument()
  })

  it('clic sur Affecter le résultat ouvre l’aperçu avec le montant', async () => {
    listerSimule.mockResolvedValue([exercice({ status: 'clos' })])
    apercuAffectationSimule.mockResolvedValue(apercuAffectation({ montant: 100000 }))
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Affecter le résultat' }))

    expect(await screen.findByText('Excédent à affecter : 100 000 F')).toBeVisible()
    expect(screen.getByLabelText('Réserve générale (5521)')).toBeVisible()
  })

  it('déjà affecté : message dédié, pas de formulaire', async () => {
    listerSimule.mockResolvedValue([exercice({ status: 'clos' })])
    apercuAffectationSimule.mockResolvedValue(apercuAffectation({ deja_affecte: true }))
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Affecter le résultat' }))

    expect(
      await screen.findByText('Le résultat de cet exercice a déjà été affecté.'),
    ).toBeVisible()
  })

  it('résultat nul : message dédié, pas de formulaire', async () => {
    listerSimule.mockResolvedValue([exercice({ status: 'clos' })])
    apercuAffectationSimule.mockResolvedValue(apercuAffectation({ montant: null }))
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Affecter le résultat' }))

    expect(
      await screen.findByText(
        'Le résultat de clôture de cet exercice était nul : rien à affecter.',
      ),
    ).toBeVisible()
  })

  it('déficit : aucun champ de ventilation, report à nouveau intégral imposé', async () => {
    listerSimule.mockResolvedValue([exercice({ status: 'clos' })])
    apercuAffectationSimule.mockResolvedValue(apercuAffectation({ montant: -7000 }))
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Affecter le résultat' }))

    expect(await screen.findByText('Déficit à affecter : 7 000 F')).toBeVisible()
    expect(
      screen.getByText('Le déficit sera reporté intégralement en report à nouveau (58) : 7 000 F.'),
    ).toBeVisible()
    expect(screen.queryByLabelText('Réserve générale (5521)')).not.toBeInTheDocument()
    // Pas de ventilation à saisir : le bouton n'est jamais bloqué pour un déficit.
    expect(screen.getByRole('button', { name: 'Affecter le résultat' })).toBeEnabled()
  })

  it('excédent : le bouton reste bloqué jusqu’à ce que la ventilation totalise exactement le montant', async () => {
    listerSimule.mockResolvedValue([exercice({ status: 'clos' })])
    apercuAffectationSimule.mockResolvedValue(apercuAffectation({ montant: 10000 }))
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Affecter le résultat' }))
    await screen.findByLabelText('Réserve générale (5521)')

    expect(screen.getByRole('button', { name: 'Affecter le résultat' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Réserve générale (5521)'), {
      target: { value: '6000' },
    })
    fireEvent.change(screen.getByLabelText('Report à nouveau (58)'), {
      target: { value: '3000' },
    })
    expect(screen.getByText('Total ventilé 9 000 F — doit égaler exactement 10 000 F.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Affecter le résultat' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Report à nouveau (58)'), {
      target: { value: '4000' },
    })
    expect(
      screen.getByText('La ventilation correspond exactement à l’excédent à affecter.'),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Affecter le résultat' })).toBeEnabled()
  })

  it('confirme puis exécute l’affectation d’un excédent, affiche le résultat final', async () => {
    listerSimule.mockResolvedValue([exercice({ status: 'clos' })])
    apercuAffectationSimule.mockResolvedValue(apercuAffectation({ montant: 10000 }))
    affecterSimule.mockResolvedValue({
      exercice: exercice({ status: 'clos', resultat_affecte: true }),
      entry_number: 'OD-2026-000042',
      montant: 10000,
      ventilation: {
        reserve_generale: 0,
        reserves_facultatives: 0,
        autres_reserves: 0,
        report_a_nouveau: 10000,
      },
    })
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Affecter le résultat' }))
    fireEvent.change(await screen.findByLabelText('Report à nouveau (58)'), {
      target: { value: '10000' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Affecter le résultat' }))

    expect(
      await screen.findByText(/Affecter le résultat de l’exercice 2099 \?/),
    ).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Confirmer l’affectation' }))

    expect(
      await screen.findByText('Résultat de l’exercice 2099 affecté — pièce OD-2026-000042.'),
    ).toBeVisible()
    expect(affecterSimule).toHaveBeenCalledWith('ex1', {
      reserve_generale: 0,
      reserves_facultatives: 0,
      autres_reserves: 0,
      report_a_nouveau: 10000,
    })
  })

  it('confirme puis exécute l’affectation d’un déficit avec la ventilation implicite', async () => {
    listerSimule.mockResolvedValue([exercice({ status: 'clos' })])
    apercuAffectationSimule.mockResolvedValue(apercuAffectation({ montant: -5000 }))
    affecterSimule.mockResolvedValue({
      exercice: exercice({ status: 'clos', resultat_affecte: true }),
      entry_number: 'OD-2026-000043',
      montant: -5000,
      ventilation: {
        reserve_generale: 0,
        reserves_facultatives: 0,
        autres_reserves: 0,
        report_a_nouveau: 5000,
      },
    })
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Affecter le résultat' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Affecter le résultat' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmer l’affectation' }))

    expect(
      await screen.findByText('Résultat de l’exercice 2099 affecté — pièce OD-2026-000043.'),
    ).toBeVisible()
    expect(affecterSimule).toHaveBeenCalledWith('ex1', {
      reserve_generale: 0,
      reserves_facultatives: 0,
      autres_reserves: 0,
      report_a_nouveau: 5000,
    })
  })

  // --- À-nouveaux (lot b2b) -----------------------------------------------------------------

  it('un exercice OUVERT n’a pas de bouton Générer les à-nouveaux', async () => {
    listerSimule.mockResolvedValue([exercice()])
    afficher()

    expect(await screen.findByText('2099')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Générer les à-nouveaux' }),
    ).not.toBeInTheDocument()
  })

  it('un exercice CLOS avec à-nouveaux déjà générés affiche le badge, pas de bouton', async () => {
    listerSimule.mockResolvedValue([exercice({ status: 'clos', a_nouveaux_generes: true })])
    afficher()

    expect(await screen.findByText('À-nouveaux générés')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Générer les à-nouveaux' }),
    ).not.toBeInTheDocument()
  })

  it('clic sur Générer les à-nouveaux ouvre l’aperçu avec le détail et le total', async () => {
    listerSimule.mockResolvedValue([exercice({ status: 'clos' })])
    apercuANouveauxSimule.mockResolvedValue(apercuANouveaux())
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Générer les à-nouveaux' }))

    expect(await screen.findByText('591')).toBeVisible()
    expect(screen.getByText('10 000 F')).toBeVisible()
    expect(screen.getByText('Total reporté : 10 000 F')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Générer les à-nouveaux' })).toBeEnabled()
  })

  it('déjà généré : message dédié, pas de tableau', async () => {
    listerSimule.mockResolvedValue([exercice({ status: 'clos' })])
    apercuANouveauxSimule.mockResolvedValue(apercuANouveaux({ deja_genere: true }))
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Générer les à-nouveaux' }))

    expect(
      await screen.findByText('Les à-nouveaux de cet exercice ont déjà été générés.'),
    ).toBeVisible()
  })

  it('exercice suivant absent : avertissement, bouton bloqué', async () => {
    listerSimule.mockResolvedValue([exercice({ status: 'clos' })])
    apercuANouveauxSimule.mockResolvedValue(
      apercuANouveaux({ exercice_suivant: null, generable: false }),
    )
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Générer les à-nouveaux' }))

    expect(
      await screen.findByText(/L’exercice suivant n’existe pas encore\. Ouvrez un exercice commençant le/),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Générer les à-nouveaux' }),
    ).not.toBeInTheDocument()
  })

  it('exercice suivant pas ouvert : avertissement nommant le code et le statut', async () => {
    listerSimule.mockResolvedValue([exercice({ status: 'clos' })])
    apercuANouveauxSimule.mockResolvedValue(
      apercuANouveaux({
        exercice_suivant: exercice({ id: 'ex2', code: '2100', status: 'clos' }),
        generable: false,
      }),
    )
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Générer les à-nouveaux' }))

    expect(
      await screen.findByText('L’exercice suivant (2100) existe mais n’est pas ouvert (statut : Clos).'),
    ).toBeVisible()
  })

  it('bilan déséquilibré : avertissement explicite', async () => {
    listerSimule.mockResolvedValue([exercice({ status: 'clos' })])
    apercuANouveauxSimule.mockResolvedValue(
      apercuANouveaux({ total_debit: 10000, total_credit: 9000, equilibre: false, generable: false }),
    )
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Générer les à-nouveaux' }))

    expect(
      await screen.findByText(/Le bilan de clôture ne s’équilibre pas/),
    ).toBeVisible()
  })

  it('rien à reporter : message dédié', async () => {
    listerSimule.mockResolvedValue([exercice({ status: 'clos' })])
    apercuANouveauxSimule.mockResolvedValue(
      apercuANouveaux({ lignes: [], total_debit: 0, total_credit: 0, generable: false }),
    )
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Générer les à-nouveaux' }))

    expect(
      await screen.findByText('Aucun compte de bilan à solde non nul sur cet exercice : rien à reporter.'),
    ).toBeVisible()
  })

  it('confirme puis exécute la génération, affiche le résultat final', async () => {
    listerSimule.mockResolvedValue([exercice({ status: 'clos' })])
    apercuANouveauxSimule.mockResolvedValue(apercuANouveaux())
    genererANouveauxSimule.mockResolvedValue({
      exercice_suivant: exercice({ id: 'ex2', code: '2100', a_nouveaux_generes: true }),
      entry_number: 'AN-2100-000001',
      total: 10000,
    })
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Générer les à-nouveaux' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Générer les à-nouveaux' }))

    expect(
      await screen.findByText(/Générer les à-nouveaux de l’exercice 2100 à partir de la clôture de 2099/),
    ).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la génération' }))

    expect(
      await screen.findByText('À-nouveaux de l’exercice 2099 générés — pièce AN-2100-000001.'),
    ).toBeVisible()
    expect(genererANouveauxSimule).toHaveBeenCalledWith('ex1')
  })

  it('retour à la liste depuis l’aperçu des à-nouveaux', async () => {
    listerSimule.mockResolvedValue([exercice({ status: 'clos' })])
    apercuANouveauxSimule.mockResolvedValue(apercuANouveaux())
    afficher()

    fireEvent.click(await screen.findByRole('button', { name: 'Générer les à-nouveaux' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Retour à la liste' }))

    expect(await screen.findByText('Exercices comptables')).toBeVisible()
  })
})
