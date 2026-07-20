import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/** Port du backend FastAPI en développement (uvicorn). */
const BACKEND = 'http://127.0.0.1:8001'

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    // Alias exigé par shadcn/ui. Doit rester synchronisé avec `paths` de tsconfig.app.json :
    // TypeScript et Vite résolvent les imports séparément, l'un pour le typage, l'autre pour
    // le bundle. N'en configurer qu'un donne du code qui compile mais ne se charge pas, ou
    // l'inverse.
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },

  server: {
    proxy: {
      // LE PROXY N'EST PAS UN CONFORT, C'EST UNE CONDITION DE FONCTIONNEMENT.
      //
      // Le refresh token voyage dans un cookie httpOnly SameSite=Strict. « Strict » veut
      // dire : envoyé uniquement si la page et la requête partagent la MÊME origine. Front
      // sur 5173 et API sur 8001 = deux origines = le cookie ne part jamais = la session ne
      // survit pas au premier rafraîchissement. Le proxy fait voir au navigateur une seule
      // origine, celle du front.
      //
      // En production, c'est un vrai reverse proxy (nginx) qui tient ce rôle — cf. la
      // checklist de déploiement, point « front et API sur le même domaine ».
      '/api': {
        target: BACKEND,
        changeOrigin: true,
        rewrite: (chemin) => chemin.replace(/^\/api/, ''),

        // LE PIÈGE QUI CASSE TOUT EN SILENCE.
        //
        // Le backend pose le cookie avec Path=/auth (il ignore tout du préfixe /api que le
        // front ajoute). Le navigateur l'enregistre donc sur /auth, et ne le renvoie JAMAIS
        // à /api/auth/refresh, qui ne commence pas par /auth.
        //
        // Le symptôme aurait été trompeur : la connexion réussit, tout fonctionne pendant
        // quinze minutes, puis le premier rafraîchissement échoue en 401 et l'utilisateur
        // est déconnecté sans explication. Un défaut qui n'apparaît qu'au bout d'un quart
        // d'heure d'usage est de ceux qu'on ne trouve pas.
        //
        // On réécrit donc le Path du cookie pour qu'il corresponde au chemin que le
        // navigateur voit réellement. En production, nginx doit faire la même chose :
        //     proxy_cookie_path /auth /api/auth;
        cookiePathRewrite: { '/auth': '/api/auth' },
      },
    },
  },
})
