import { LIBELLES } from '@/libelles/fr'

/**
 * Structure du menu, en DONNÉE — pas en JSX.
 *
 * La séparer du rendu a deux vertus : elle se lit d'un coup d'œil comme une table des
 * matières du produit, et les règles (permission requise, « à venir ») s'appliquent
 * uniformément sans être recopiées dans le balisage.
 *
 * ON NE TRICHE PAS. Une entrée est soit 'actif' (une page existe, on peut y aller), soit
 * 'a_venir' (visible, mais clairement non disponible). Aucune entrée ne prétend marcher
 * sans marcher : un client en démonstration doit distinguer au premier regard ce qui existe
 * de ce qui est promis. C'est le type qui l'impose — 'a_venir' n'a ni chemin ni permission,
 * donc rien à cliquer.
 */

const M = LIBELLES.menu

/** Une entrée ACTIVE : une page existe. `permission`, si présente, la conditionne. */
interface EntreeActive {
  etat: 'actif'
  libelle: string
  chemin: string
  /** Code de permission requis pour VOIR l'entrée. Absente = visible par tout connecté. */
  permission?: string
}

/** Une entrée À VENIR : montrée, mais non disponible. Ni chemin, ni clic. */
interface EntreeAVenir {
  etat: 'a_venir'
  libelle: string
}

export type EntreeMenu = EntreeActive | EntreeAVenir

export interface GroupeMenu {
  /** Identifiant stable pour l'état déplié/replié — indépendant du libellé traduit. */
  id: string
  titre: string
  entrees: EntreeMenu[]
}

const aVenir = (libelle: string): EntreeAVenir => ({ etat: 'a_venir', libelle })

export const MENU: readonly GroupeMenu[] = [
  {
    id: 'administration',
    titre: M.groupes.administration,
    entrees: [
      // Chaque entrée ACTIVE est conditionnée à sa permission : sans elle, l'entrée
      // disparaît (le serveur refuserait de toute façon en 403).
      {
        etat: 'actif',
        libelle: M.entrees.utilisateurs,
        chemin: '/utilisateurs',
        permission: 'users.read',
      },
      aVenir(M.entrees.rolesHabilitations),
      {
        etat: 'actif',
        libelle: M.entrees.journalAudit,
        chemin: '/audit',
        permission: 'audit.read',
      },
      aVenir(M.entrees.parametrage),
    ],
  },
  {
    id: 'clientele',
    titre: M.groupes.clientele,
    entrees: [aVenir(M.entrees.tiers)],
  },
  {
    id: 'operations',
    titre: M.groupes.operations,
    entrees: [
      aVenir(M.entrees.caisseGuichet),
      aVenir(M.entrees.epargneDepots),
      aVenir(M.entrees.credit),
      aVenir(M.entrees.recouvrement),
    ],
  },
  {
    id: 'comptabilite',
    titre: M.groupes.comptabilite,
    entrees: [
      aVenir(M.entrees.comptaGenerale),
      aVenir(M.entrees.comptaAnalytique),
      aVenir(M.entrees.tresorerieImmo),
    ],
  },
  {
    id: 'conformite',
    titre: M.groupes.conformite,
    entrees: [aVenir(M.entrees.reportingBceao), aVenir(M.entrees.lbcFt)],
  },
  {
    id: 'pilotage',
    titre: M.groupes.pilotage,
    entrees: [aVenir(M.entrees.decisionnel)],
  },
  {
    id: 'systeme',
    titre: M.groupes.systeme,
    entrees: [
      aVenir(M.entrees.multiAgences),
      aVenir(M.entrees.canauxNumerique),
      aVenir(M.entrees.ged),
    ],
  },
]

/**
 * Filtre les entrées ACTIVES selon les permissions détenues.
 *
 * Une entrée active à permission non détenue est RETIRÉE (règle : « n'afficher Utilisateurs
 * que si users.read »). Les entrées « à venir » restent toujours visibles — leur objet est
 * précisément de montrer la feuille de route. Un groupe qui se retrouverait vide n'est pas
 * affiché.
 */
export function menuVisible(permissions: readonly string[]): GroupeMenu[] {
  const detient = new Set(permissions)
  return MENU.map((groupe) => ({
    ...groupe,
    entrees: groupe.entrees.filter(
      (entree) =>
        entree.etat === 'a_venir' || entree.permission === undefined || detient.has(entree.permission),
    ),
  })).filter((groupe) => groupe.entrees.length > 0)
}
