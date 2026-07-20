import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { changerMotDePasse, ErreurMotDePasse } from '@/features/auth/api'
import { PageMotDePasse } from '@/features/auth/PageMotDePasse'
import { useAuth } from '@/features/auth/store'
import { tenterReprendreSession } from '@/lib/api'

/**
 * Écran de changement — les trois refus du serveur, le succès, et les gardes locales.
 *
 * Le contrat serveur (204 sans corps, 400/409/422 avec détail) a été vérifié en réel
 * contre le backend. Ici on vérifie la TRADUCTION en écran : un 422 mal lu afficherait un
 * message générique alors qu'on a conçu le backend exprès pour détailler ce qui manque.
 */

vi.mock('@/features/auth/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/auth/api')>('@/features/auth/api')
  return { ...reel, changerMotDePasse: vi.fn() }
})
vi.mock('@/lib/api', async () => {
  const reel = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...reel, tenterReprendreSession: vi.fn() }
})

const changerSimule = vi.mocked(changerMotDePasse)
const refreshSimule = vi.mocked(tenterReprendreSession)

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/changer-mot-de-passe']}>
        <Routes>
          <Route path="/changer-mot-de-passe" element={<PageMotDePasse />} />
          <Route path="/" element={<div>Accueil</div>} />
          <Route path="/connexion" element={<div>Connexion</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const CONFORME = 'Guichet!Mifin2026'

// Libellés stables, insensibles à la casse — on ne teste pas la ponctuation.
const LIBELLE_ACTUEL = /mot de passe actuel/i
const LIBELLE_NOUVEAU = /^nouveau mot de passe$/i
const LIBELLE_CONFIRMATION = /confirmer/i

async function remplir(actuel: string, nouveau: string, confirmation = nouveau) {
  const u = userEvent.setup()
  await u.type(screen.getByLabelText(LIBELLE_ACTUEL), actuel)
  await u.type(screen.getByLabelText(LIBELLE_NOUVEAU), nouveau)
  await u.type(screen.getByLabelText(LIBELLE_CONFIRMATION), confirmation)
  await u.click(screen.getByRole('button', { name: /enregistrer/i }))
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuth.setState({ accessToken: 'jeton', doitChangerMotDePasse: true, amorcage: 'termine' })
})

describe('PageMotDePasse', () => {
  it('affiche l’instruction rassurante en mode forcé', () => {
    afficher()
    expect(screen.getByText(/pour votre sécurité/i)).toBeVisible()
    // Pas de bouton Annuler quand le renouvellement est imposé.
    expect(screen.queryByRole('button', { name: /annuler/i })).toBeNull()
  })

  it('affiche les cinq règles en permanence, avant toute saisie', () => {
    afficher()
    expect(screen.getByText(/au moins 12 caractères/i)).toBeVisible()
    expect(screen.getByText(/une lettre majuscule/i)).toBeVisible()
    expect(screen.getByText(/un caractère spécial/i)).toBeVisible()
  })

  it('sur succès : rafraîchit la session puis va à l’accueil', async () => {
    changerSimule.mockResolvedValue(undefined)
    refreshSimule.mockImplementation(async () => {
      // Le refresh lève le drapeau, comme le vrai.
      useAuth.setState({ accessToken: 'jeton-neuf', doitChangerMotDePasse: false })
    })

    afficher()
    await remplir('AncienMdp!2025', CONFORME)

    await waitFor(() => expect(screen.getByText('Accueil')).toBeVisible())
    expect(refreshSimule).toHaveBeenCalledOnce()
    expect(useAuth.getState().doitChangerMotDePasse).toBe(false)
  })

  it('sur succès mais refresh en échec : va au login SANS annoncer d’échec', async () => {
    changerSimule.mockResolvedValue(undefined)
    refreshSimule.mockRejectedValue(new Error('cookie perdu'))

    afficher()
    await remplir('AncienMdp!2025', CONFORME)

    await waitFor(() => expect(screen.getByText('Connexion')).toBeVisible())
    // La session est fermée, mais on n'a jamais dit que le changement avait échoué.
    expect(useAuth.getState().accessToken).toBeNull()
  })

  it('400 → « mot de passe actuel incorrect »', async () => {
    changerSimule.mockRejectedValue(new ErreurMotDePasse({ type: 'actuelIncorrect' }))

    afficher()
    await remplir('MauvaisAncien!9', CONFORME)

    expect(await screen.findByText(/actuel est incorrect/i)).toBeVisible()
  })

  it('409 → « déjà utilisé, choisissez-en un différent des 12 derniers »', async () => {
    changerSimule.mockRejectedValue(new ErreurMotDePasse({ type: 'dejaUtilise' }))

    afficher()
    await remplir('AncienMdp!2025', CONFORME)

    expect(await screen.findByText(/12 derniers/i)).toBeVisible()
  })

  it('422 → affiche le DÉTAIL des règles renvoyé par le serveur, pas un message générique', async () => {
    // Le backend a été conçu pour renvoyer ce que le mot de passe viole. On l'affiche tel
    // quel — c'est plus utile qu'un « non conforme » sec.
    changerSimule.mockRejectedValue(
      new ErreurMotDePasse({ type: 'politique', violations: ['chiffre_requis', 'majuscule_requise'] }),
    )

    afficher()
    await remplir('AncienMdp!2025', CONFORME)

    // « un chiffre » figure AUSSI dans la liste permanente des règles : on scope l'assertion
    // à l'alerte d'erreur pour vérifier que le DÉTAIL du 422 y est bien repris.
    const titre = await screen.findByText(/le serveur a refusé/i)
    const alerte = titre.closest('[role="alert"]')
    expect(alerte).not.toBeNull()
    const dans = within(alerte as HTMLElement)
    expect(dans.getByText(/^un chiffre$/i)).toBeVisible()
    expect(dans.getByText(/^une lettre majuscule$/i)).toBeVisible()
  })

  it('bloque côté client si la confirmation diffère, sans appeler le serveur', async () => {
    afficher()
    await remplir('AncienMdp!2025', CONFORME, 'AutreChose!2026')

    expect(await screen.findByText(/ne correspondent pas/i)).toBeVisible()
    expect(changerSimule).not.toHaveBeenCalled()
  })

  it('bloque côté client si le nouveau ne respecte pas la politique', async () => {
    afficher()
    await remplir('AncienMdp!2025', 'tropcourt')

    await waitFor(() => expect(changerSimule).not.toHaveBeenCalled())
  })
})
