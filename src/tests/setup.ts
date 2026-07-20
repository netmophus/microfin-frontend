import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Chaque test repart d'un DOM vide : sans ce nettoyage, le rendu précédent reste monté et
// les requêtes par texte trouvent deux éléments au lieu d'un.
afterEach(cleanup)
