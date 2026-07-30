import '@testing-library/jest-dom/vitest'

import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// findBy*/waitFor attendent une résolution asynchrone (fetch React Query + rendu). Le défaut de
// 1000 ms suffit à vide, mais la suite COMPLÈTE lance ~25 fichiers en parallèle : sous cette
// contention, une résolution parfois >1 s faisait échouer des tests par intermittence (flaky de
// timeout, jamais les mêmes, sans rapport avec le code testé). On donne de la marge — un test qui
// passe résout vite et n'attend pas ce plafond, donc aucune perte de vitesse.
configure({ asyncUtilTimeout: 5000 })

// Chaque test repart d'un DOM vide : sans ce nettoyage, le rendu précédent reste monté et
// les requêtes par texte trouvent deux éléments au lieu d'un.
afterEach(cleanup)
