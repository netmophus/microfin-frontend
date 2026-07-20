import MockAdapter from 'axios-mock-adapter'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useAuth } from '@/features/auth/store'
import { api, clientRefresh } from '@/lib/api'

/**
 * L'intercepteur de rafraîchissement — la pièce la plus délicate du client HTTP.
 *
 * LE TEST QUI COMPTE est celui du SINGLE-FLIGHT. Le backend fait tourner le refresh token à
 * chaque usage et traite la réutilisation d'un jeton déjà consommé comme un VOL : il révoque
 * alors TOUTES les sessions. Trois requêtes qui échouent ensemble et déclenchent trois
 * refresh, c'est donc un succès et deux « vols » — l'utilisateur est déconnecté de partout,
 * et le journal de conformité enregistre de fausses alertes qui feront croire à une attaque
 * lors du prochain contrôle.
 *
 * Un intercepteur naïf déconnecte l'utilisateur au moment précis où il essaie de le sauver.
 */

let simulateur: MockAdapter
// Le refresh passe par une instance DÉDIÉE, sans intercepteur : il lui faut son propre
// simulateur, sinon l'appel partirait vraiment sur le réseau et le test mesurerait autre
// chose que ce qu'il croit.
let simulateurRefresh: MockAdapter

beforeEach(() => {
  simulateur = new MockAdapter(api)
  simulateurRefresh = new MockAdapter(clientRefresh)
  useAuth.setState({ accessToken: 'jeton-perime', doitChangerMotDePasse: false, amorcage: 'termine' })
})

afterEach(() => {
  simulateur.restore()
  simulateurRefresh.restore()
})

describe('intercepteur de rafraîchissement', () => {
  it('rejoue la requête après un refresh réussi', async () => {
    simulateur.onGet('/ressource').replyOnce(401)
    simulateurRefresh.onPost('/auth/refresh').reply(200, { access_token: 'jeton-neuf' })
    simulateur.onGet('/ressource').reply(200, { ok: true })

    const reponse = await api.get('/ressource')

    expect(reponse.data).toEqual({ ok: true })
    expect(useAuth.getState().accessToken).toBe('jeton-neuf')
  })

  it('ne lance QU’UN SEUL refresh pour plusieurs requêtes qui échouent ensemble', async () => {
    let appelsRefresh = 0
    simulateur.onGet('/a').replyOnce(401)
    simulateur.onGet('/b').replyOnce(401)
    simulateur.onGet('/c').replyOnce(401)
    simulateurRefresh.onPost('/auth/refresh').reply(() => {
      appelsRefresh += 1
      return [200, { access_token: 'jeton-neuf' }]
    })
    simulateur.onGet('/a').reply(200, { r: 'a' })
    simulateur.onGet('/b').reply(200, { r: 'b' })
    simulateur.onGet('/c').reply(200, { r: 'c' })

    const reponses = await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')])

    // UN seul refresh, malgré trois 401 simultanés. Trois refresh auraient signifié deux
    // jetons rejoués -> détection de vol -> révocation totale des sessions.
    expect(appelsRefresh).toBe(1)
    expect(reponses.map((r) => r.data)).toEqual([{ r: 'a' }, { r: 'b' }, { r: 'c' }])
  })

  it('ferme la session quand le refresh échoue', async () => {
    simulateur.onGet('/ressource').reply(401)
    simulateurRefresh.onPost('/auth/refresh').reply(401)

    await expect(api.get('/ressource')).rejects.toThrow()

    expect(useAuth.getState().accessToken).toBeNull()
  })

  it('ne boucle pas : une requête déjà rejouée qui échoue encore n’est pas relancée', async () => {
    let appelsRessource = 0
    let appelsRefresh = 0
    simulateur.onGet('/ressource').reply(() => {
      appelsRessource += 1
      return [401]
    })
    simulateurRefresh.onPost('/auth/refresh').reply(() => {
      appelsRefresh += 1
      return [200, { access_token: 'jeton-neuf' }]
    })

    await expect(api.get('/ressource')).rejects.toThrow()

    // Une tentative, un refresh, un rejeu — puis on s'arrête. Sans le drapeau `_rejoue`,
    // ce scénario martèlerait le serveur indéfiniment.
    expect(appelsRessource).toBe(2)
    expect(appelsRefresh).toBe(1)
  })

  it('ne rafraîchit PAS sur un 401 de connexion', async () => {
    // Un 401 sur /auth/login est un mauvais mot de passe, pas une session expirée.
    // Rafraîchir masquerait l'échec réel à l'utilisateur.
    let appelsRefresh = 0
    simulateurRefresh.onPost('/auth/refresh').reply(() => {
      appelsRefresh += 1
      return [200, { access_token: 'x' }]
    })
    simulateur.onPost('/auth/login').reply(401)

    await expect(api.post('/auth/login', {})).rejects.toThrow()

    expect(appelsRefresh).toBe(0)
  })

  it('ne rafraîchit PAS sur un 403 de mot de passe à renouveler', async () => {
    // La session est valide ; c'est le COMPTE qui est bridé. Un refresh n'y changerait rien
    // et ferait tourner le jeton pour rien.
    let appelsRefresh = 0
    simulateurRefresh.onPost('/auth/refresh').reply(() => {
      appelsRefresh += 1
      return [200, { access_token: 'x' }]
    })
    simulateur.onGet('/users').reply(403, {}, { 'x-erreur-code': 'password_change_required' })

    await expect(api.get('/users')).rejects.toThrow()

    expect(appelsRefresh).toBe(0)
    expect(useAuth.getState().accessToken).toBe('jeton-perime')
  })

  it('porte le jeton courant, et non celui d’installation', async () => {
    useAuth.setState({ accessToken: 'jeton-du-moment' })
    simulateur.onGet('/ressource').reply((config) => [200, { recu: config.headers?.Authorization }])

    const reponse = await api.get('/ressource')

    expect(reponse.data.recu).toBe('Bearer jeton-du-moment')
  })
})
