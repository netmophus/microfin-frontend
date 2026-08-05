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
  /** Permission(s) requise(s) pour VOIR l'entrée. Un tableau = ANY-OF (le guichet : épargne OU
   * parts, un seul onglet suffit à justifier l'entrée). Absente = visible par tout connecté. */
  permission?: string | string[]
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
    entrees: [
      // Visible dès tiers.read.basic (le minimum : un caissier consulte au guichet).
      {
        etat: 'actif',
        libelle: M.entrees.tiers,
        chemin: '/tiers',
        permission: 'tiers.read.basic',
      },
    ],
  },
  {
    id: 'operations',
    titre: M.groupes.operations,
    entrees: [
      aVenir(M.entrees.caisseGuichet),
      // Guichet (dépôt/retrait épargne + comptant/libération parts) : à onglets, visible dès
      // qu'on opère sur AU MOINS l'un des deux (le caissier a généralement les deux).
      {
        etat: 'actif',
        libelle: M.entrees.guichetEpargne,
        chemin: '/guichet',
        permission: ['epargne.operation.deposit', 'tiers.shares.pay'],
      },
      // Versement des intérêts : acte d'INSTITUTION, réservé à la direction.
      {
        etat: 'actif',
        libelle: M.entrees.versementInterets,
        chemin: '/epargne/interets',
        permission: 'epargne.interet.executer',
      },
      {
        etat: 'actif',
        libelle: M.entrees.credit,
        chemin: '/credit',
        permission: 'credit.demande.read',
      },
      aVenir(M.entrees.recouvrement),
    ],
  },
  {
    id: 'comptabilite',
    titre: M.groupes.comptabilite,
    entrees: [
      // Plan de comptes : consultation + gestion unitaire (Bloc 1 du paramétrage comptable).
      {
        etat: 'actif',
        libelle: M.entrees.planComptable,
        chemin: '/comptabilite/plan',
        permission: 'compta.plan.read',
      },
      // Rattachements (Bloc 5) : consultation ouverte à compta.plan.read, édition gérée par
      // l'écran lui-même (bouton « Modifier » masqué sans compta.plan.manage).
      {
        etat: 'actif',
        libelle: M.entrees.rattachementsEpargne,
        chemin: '/comptabilite/rattachements-epargne',
        permission: 'compta.plan.read',
      },
      {
        etat: 'actif',
        libelle: M.entrees.rattachementsCaisse,
        chemin: '/comptabilite/rattachements-caisse',
        permission: 'compta.plan.read',
      },
      {
        etat: 'actif',
        libelle: M.entrees.parametresParts,
        chemin: '/comptabilite/parametres-parts',
        permission: 'compta.plan.read',
      },
      // Paliers de souffrance (CR5a) : paramétrage seul, aucune reclassification automatique
      // encore branchée (CR5c, à venir) — même paire de permissions que les autres Bloc 5.
      {
        etat: 'actif',
        libelle: M.entrees.paliersSouffrance,
        chemin: '/comptabilite/paliers-souffrance',
        permission: 'compta.plan.read',
      },
      // Rapports (R1/R2) : lecture pure, réservés à compta.rapport.read.
      {
        etat: 'actif',
        libelle: M.entrees.grandLivre,
        chemin: '/comptabilite/grand-livre',
        permission: 'compta.rapport.read',
      },
      {
        etat: 'actif',
        libelle: M.entrees.balance,
        chemin: '/comptabilite/balance',
        permission: 'compta.rapport.read',
      },
      aVenir(M.entrees.comptaAnalytique),
      // Rapprochement épargne : vue de contrôle réservée à l'audit/direction/comptable.
      {
        etat: 'actif',
        libelle: M.entrees.rapprochementEpargne,
        chemin: '/epargne/rapprochement',
        permission: 'epargne.rapprochement.read',
      },
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
  const visible = (p: string | string[]) =>
    Array.isArray(p) ? p.some((x) => detient.has(x)) : detient.has(p)
  return MENU.map((groupe) => ({
    ...groupe,
    entrees: groupe.entrees.filter(
      (entree) => entree.etat === 'a_venir' || entree.permission === undefined || visible(entree.permission),
    ),
  })).filter((groupe) => groupe.entrees.length > 0)
}
