import path from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    // Marge pour la suite complète sous forte charge parallèle : un findBy* peut attendre jusqu'à
    // 5 s (asyncUtilTimeout), le test doit lui laisser plus que ce plafond. Voir src/tests/setup.ts.
    testTimeout: 15000,
  },
})
