import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ErreurConnexion, seConnecter } from '@/features/auth/api'
import { PageConnexion } from '@/features/auth/PageConnexion'
import { useAuth } from '@/features/auth/store'

/**
 * Écran de connexion — les TROIS réponses réelles du backend, plus la panne réseau.
 *
 * Ce qui est vérifié ici est la TRADUCTION d'une réponse serveur en écran : c'est là que
 * les erreurs coûtent cher, parce qu'un mauvais message n'échoue pas — il ment. Un 423 mal
 * lu afficherait « identifiants incorrects » à quelqu'un qui a saisi le bon mot de passe, et
 * qui réessaierait jusqu'à prolonger son propre verrou.
 *
 * L'appel réseau est simulé ; le contrat qu'il respecte, lui, a été vérifié en réel contre
 * le backend (login, refresh, 401, 403, 423) — cf. la vérification de bout en bout.
 */

vi.mock('@/features/auth/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/auth/api')>('@/features/auth/api')
  return { ...reel, seConnecter: vi.fn() }
})

const seConnecterSimule = vi.mocked(seConnecter)

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PageConnexion />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function remplirEtValider(identifiant = 'admin', motDePasse = 'MotDePasse!123') {
  const utilisateur = userEvent.setup()
  await utilisateur.type(screen.getByLabelText(/identifiant/i), identifiant)
  await utilisateur.type(screen.getByLabelText(/mot de passe/i), motDePasse)
  await utilisateur.click(screen.getByRole('button', { name: /se connecter/i }))
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuth.setState({ accessToken: null, doitChangerMotDePasse: false, amorcage: 'termine' })
})

describe('PageConnexion', () => {
  it('ouvre la session sur succès, et garde le jeton EN MÉMOIRE', async () => {
    seConnecterSimule.mockResolvedValue({ accessToken: 'jeton-abc', doitChangerMotDePasse: false })

    afficher()
    await remplirEtValider()

    await waitFor(() => expect(useAuth.getState().accessToken).toBe('jeton-abc'))
    // LA garantie du choix hybride : rien ne doit atterrir dans un stockage persistant.
    expect(localStorage.getItem('accessToken')).toBeNull()
    expect(JSON.stringify(localStorage)).not.toContain('jeton-abc')
    expect(JSON.stringify(sessionStorage)).not.toContain('jeton-abc')
  })

  it('affiche le message GÉNÉRIQUE sur 401', async () => {
    // Le backend est volontairement uniforme : compte inexistant, mauvais mot de passe et
    // compte désactivé donnent la même réponse. Le front ne doit rien inventer de plus
    // précis, sous peine de révéler qu'un identifiant existe.
    seConnecterSimule.mockRejectedValue(new ErreurConnexion({ type: 'identifiants' }))

    afficher()
    await remplirEtValider()

    expect(await screen.findByRole('alert')).toHaveTextContent(/identifiant ou mot de passe incorrect/i)
    expect(useAuth.getState().accessToken).toBeNull()
  })

  it('affiche le verrou AVEC son échéance sur 423', async () => {
    // Cas où l'utilisateur a donné le BON mot de passe : il mérite de savoir jusqu'à quand
    // son compte est bloqué, sinon il réessaie et prolonge son propre verrou.
    const dans30Minutes = new Date(Date.now() + 30 * 60_000).toISOString()
    seConnecterSimule.mockRejectedValue(
      new ErreurConnexion({ type: 'verrouille', verrouJusqua: dans30Minutes }),
    )

    afficher()
    await remplirEtValider()

    const alerte = await screen.findByRole('alert')
    expect(alerte).toHaveTextContent(/compte verrouillé/i)
    expect(alerte).toHaveTextContent(/de nouveau accessible/i)
  })

  it('reste compréhensible si le verrou arrive SANS échéance exploitable', async () => {
    // Une date absente ou illisible ne doit pas produire « Invalid Date » à l'écran.
    seConnecterSimule.mockRejectedValue(
      new ErreurConnexion({ type: 'verrouille', verrouJusqua: 'pas-une-date' }),
    )

    afficher()
    await remplirEtValider()

    const alerte = await screen.findByRole('alert')
    expect(alerte).toHaveTextContent(/temporairement bloqué/i)
    expect(alerte).not.toHaveTextContent(/invalid/i)
  })

  it('distingue une panne serveur d’un mauvais mot de passe', async () => {
    // Sans cette distinction, un agent ressaisit dix fois des identifiants corrects alors
    // que le backend est simplement arrêté.
    seConnecterSimule.mockRejectedValue(new ErreurConnexion({ type: 'reseau' }))

    afficher()
    await remplirEtValider()

    expect(await screen.findByRole('alert')).toHaveTextContent(/serveur ne répond pas/i)
  })

  it('signale le mot de passe à renouveler', async () => {
    seConnecterSimule.mockRejectedValue(new ErreurConnexion({ type: 'motDePasseARenouveler' }))

    afficher()
    await remplirEtValider()

    expect(await screen.findByRole('alert')).toHaveTextContent(/renouvel/i)
  })

  it('valide la présence des champs sans appeler le serveur', async () => {
    afficher()
    await userEvent.setup().click(screen.getByRole('button', { name: /se connecter/i }))

    expect(await screen.findByText(/saisissez votre identifiant/i)).toBeVisible()
    expect(seConnecterSimule).not.toHaveBeenCalled()
  })

  it('efface l’erreur précédente à la nouvelle tentative', async () => {
    // Laisser l'ancienne erreur affichée pendant le nouvel essai laisserait croire qu'il a
    // échoué lui aussi.
    seConnecterSimule.mockRejectedValueOnce(new ErreurConnexion({ type: 'identifiants' }))
    afficher()
    await remplirEtValider()
    expect(await screen.findByRole('alert')).toBeVisible()

    seConnecterSimule.mockResolvedValue({ accessToken: 'jeton-2', doitChangerMotDePasse: false })
    await remplirEtValider()

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })
})
