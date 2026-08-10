import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { chargerSessionCourante, fermerSession, ouvrirSession } from '@/features/caisse/api'
import { PageCaisse } from '@/features/caisse/PageCaisse'

/**
 * Session de caisse (CA1/CA4). Points durs : aucune session -> formulaire d'ouverture ; une
 * session ouverte -> solde théorique EN DIRECT affiché ; la fermeture montre l'écart en toutes
 * lettres AVANT confirmation (jamais découvert après coup) ; ne bloque JAMAIS sur la taille de
 * l'écart (CA2 pas encore construite) ; le bouton Actualiser recharge le solde en direct.
 */

vi.mock('@/features/caisse/api', async () => {
  const reel = await vi.importActual<typeof import('@/features/caisse/api')>('@/features/caisse/api')
  return { ...reel, chargerSessionCourante: vi.fn(), ouvrirSession: vi.fn(), fermerSession: vi.fn() }
})

const sessionSimulee = vi.mocked(chargerSessionCourante)
const ouvertureSimulee = vi.mocked(ouvrirSession)
const fermetureSimulee = vi.mocked(fermerSession)

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/caisse']}>
        <Routes>
          <Route path="/caisse" element={<PageCaisse />} />
          <Route path="/caisse/sessions/:id/lettre" element={<div>Lettre de la session</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const sessionOuverte = {
  id: 'ses-1',
  agency_id: 'ag-1',
  agency_nom: 'Siège',
  caissier_id: 'cai-1',
  caissier_nom: 'Caissier Test',
  compte_caisse_number: '101111',
  fonds_initial: 50_000,
  opened_at: '2026-08-07T08:00:00Z',
  closed_at: null,
  solde_theorique_actuel: 60_000,
  montant_reel_cloture: null,
  solde_theorique_cloture: null,
  ecart: null,
  status: 'ouverte' as const,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PageCaisse', () => {
  it('aucune session ouverte : affiche le formulaire d’ouverture', async () => {
    sessionSimulee.mockResolvedValue(null)
    afficher()

    expect(await screen.findByText('Ouvrir la caisse')).toBeVisible()
    expect(ouvertureSimulee).not.toHaveBeenCalled()
  })

  it('refuse d’ouvrir sans fonds initial saisi', async () => {
    sessionSimulee.mockResolvedValue(null)
    afficher()
    await screen.findByText('Ouvrir la caisse')

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir la caisse' }))

    expect(
      await screen.findByText('Indiquez le fonds initial compté, en francs.'),
    ).toBeVisible()
    expect(ouvertureSimulee).not.toHaveBeenCalled()
  })

  it('ouvre la caisse avec le fonds initial saisi', async () => {
    sessionSimulee.mockResolvedValueOnce(null).mockResolvedValueOnce(sessionOuverte)
    ouvertureSimulee.mockResolvedValue(sessionOuverte)
    afficher()
    await screen.findByText('Ouvrir la caisse')

    fireEvent.change(screen.getByLabelText('Fonds initial compté'), { target: { value: '50000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir la caisse' }))

    await waitFor(() => expect(ouvertureSimulee).toHaveBeenCalledWith(50_000))
    expect(await screen.findByText('60 000 F')).toBeVisible() // solde théorique en direct
  })

  it('session ouverte : affiche le solde théorique en direct et le rafraîchit sur demande', async () => {
    sessionSimulee.mockResolvedValue(sessionOuverte)
    afficher()

    expect(await screen.findByText('60 000 F')).toBeVisible()
    expect(screen.getByText('101111')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: /Actualiser/ }))
    await waitFor(() => expect(sessionSimulee).toHaveBeenCalledTimes(2))
  })

  it('fermeture : montre l’écart en toutes lettres avant toute confirmation', async () => {
    sessionSimulee.mockResolvedValue(sessionOuverte)
    afficher()
    await screen.findByText('60 000 F')

    fireEvent.change(screen.getByLabelText('Montant compté à la fermeture'), {
      target: { value: '65000' },
    })

    expect(await screen.findByText('Excédent de 5 000 F.')).toBeVisible()
    expect(fermetureSimulee).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Fermer la caisse' }))
    expect(await screen.findByText('Confirmer la fermeture ?')).toBeVisible()
    expect(screen.getByText(/Excédent de 5 000 F/)).toBeVisible()
    expect(fermetureSimulee).not.toHaveBeenCalled() // confirmation affichée, rien exécuté
  })

  it('fermeture confirmée : ferme, même avec un écart énorme (CA1 ne bloque jamais)', async () => {
    // Une fois fermée, le rechargement (invalidateQueries) doit renvoyer null : la session
    // fermée n'est plus « la session courante » de l'acteur.
    sessionSimulee.mockResolvedValueOnce(sessionOuverte).mockResolvedValue(null)
    fermetureSimulee.mockResolvedValue({
      ...sessionOuverte,
      status: 'fermee',
      closed_at: '2026-08-07T18:00:00Z',
      solde_theorique_actuel: null,
      montant_reel_cloture: 9_999_999,
      solde_theorique_cloture: 60_000,
      ecart: 9_939_999,
    })
    afficher()
    await screen.findByText('60 000 F')

    fireEvent.change(screen.getByLabelText('Montant compté à la fermeture'), {
      target: { value: '9999999' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Fermer la caisse' }))
    await screen.findByText('Confirmer la fermeture ?')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la fermeture' }))

    await waitFor(() => expect(fermetureSimulee).toHaveBeenCalledWith('ses-1', 9_999_999))
    expect(await screen.findByText('Caisse fermée')).toBeVisible()
    expect(screen.getByText('Ouvrir une nouvelle session')).toBeVisible()
    // Excédent, pas un manquant : pas de lettre de demande d'explication (hors périmètre).
    expect(
      screen.queryByRole('button', { name: /demande d’explication/ }),
    ).toBeNull()
  })

  it('fermeture avec manquant : le bouton de la lettre apparaît et mène à la lettre', async () => {
    sessionSimulee.mockResolvedValueOnce(sessionOuverte).mockResolvedValue(null)
    fermetureSimulee.mockResolvedValue({
      ...sessionOuverte,
      status: 'fermee',
      closed_at: '2026-08-07T18:00:00Z',
      solde_theorique_actuel: null,
      montant_reel_cloture: 50_000,
      solde_theorique_cloture: 60_000,
      ecart: -10_000,
    })
    afficher()
    await screen.findByText('60 000 F')

    fireEvent.change(screen.getByLabelText('Montant compté à la fermeture'), {
      target: { value: '50000' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Fermer la caisse' }))
    await screen.findByText('Confirmer la fermeture ?')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la fermeture' }))
    await screen.findByText('Caisse fermée')

    fireEvent.click(screen.getByRole('button', { name: /demande d’explication/ }))

    expect(await screen.findByText('Lettre de la session')).toBeVisible()
  })

  it('annuler la fermeture revient au formulaire sans rien exécuter', async () => {
    sessionSimulee.mockResolvedValue(sessionOuverte)
    afficher()
    await screen.findByText('60 000 F')

    fireEvent.change(screen.getByLabelText('Montant compté à la fermeture'), {
      target: { value: '60000' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Fermer la caisse' }))
    await screen.findByText('Confirmer la fermeture ?')

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(screen.queryByText('Confirmer la fermeture ?')).toBeNull()
    expect(fermetureSimulee).not.toHaveBeenCalled()
  })

  it('erreur de chargement : affiche un message et un bouton Réessayer', async () => {
    sessionSimulee.mockRejectedValue(new Error('réseau'))
    afficher()

    expect(await screen.findByText('Impossible de charger votre session de caisse.')).toBeVisible()
    const bouton = screen.getByRole('button', { name: 'Réessayer' })

    sessionSimulee.mockResolvedValueOnce(null)
    fireEvent.click(bouton)

    expect(await screen.findByText('Ouvrir la caisse')).toBeVisible()
  })
})
