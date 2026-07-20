import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // Composants GÉNÉRÉS par shadcn/ui. Ils exportent délibérément des variantes
    // (`buttonVariants`) à côté du composant, ce que la règle de rafraîchissement rapide
    // interdit. On ne corrige pas un fichier qui sera réécrit au prochain `shadcn add` :
    // la modification serait perdue, et l'erreur reviendrait sans qu'on comprenne pourquoi.
    files: ['src/components/ui/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
