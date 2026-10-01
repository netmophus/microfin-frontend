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
      {
        etat: 'actif',
        libelle: M.entrees.rolesHabilitations,
        chemin: '/roles-habilitations',
        permission: 'roles.permissions.read',
      },
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
      // Session du caissier (CA1/CA4) : ouverture, solde théorique en direct, fermeture —
      // distincte du guichet (dépôt/retrait/remboursement) juste en dessous.
      {
        etat: 'actif',
        libelle: M.entrees.caisse,
        chemin: '/caisse',
        permission: 'caisse.session.read',
      },
      // Manquants (lettre de demande d'explication) : ANY-OF, le caissier retrouve les
      // SIENNES (caisse.session.read), le responsable/audit/direction celles de leur périmètre
      // (caisse.session.read.autres) — les deux publics partagent le même écran.
      {
        etat: 'actif',
        libelle: M.entrees.manquantsCaisse,
        chemin: '/caisse/manquants',
        permission: ['caisse.session.read', 'caisse.session.read.autres'],
      },
      // Postes de caisse (Bloc B) : ANY-OF, le responsable d'agence gère SES postes
      // (caisse.poste.manage), le comptable rattache un compte n'importe où
      // (compta.plan.manage) — même écran, chacun voit ce que sa permission autorise.
      {
        etat: 'actif',
        libelle: M.entrees.postesCaisse,
        chemin: '/caisse/postes',
        permission: ['caisse.poste.manage', 'compta.plan.manage'],
      },
      // Transferts coffre/principale/secondaire (chantier coffre-fort/caisses, sous-chantier
      // 2) : ANY-OF, initier ET réceptionner partagent le même écran (chacun voit les boutons
      // que sa permission autorise).
      {
        etat: 'actif',
        libelle: M.entrees.transfertsCaisse,
        chemin: '/caisse/transferts',
        permission: ['caisse.transfert.initier', 'caisse.transfert.valider'],
      },
      // Guichet (dépôt/retrait épargne + comptant/libération parts + remboursement crédit) :
      // à onglets, visible dès qu'on opère sur AU MOINS l'un des trois (le caissier a
      // généralement les trois).
      {
        etat: 'actif',
        libelle: M.entrees.guichetEpargne,
        chemin: '/guichet',
        permission: ['epargne.operation.deposit', 'tiers.shares.pay', 'credit.remboursement.create'],
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
      // Supervision de la souffrance (CR5c, chantier lot 2) : lecture permanente ouverte à
      // credit.delinquency.read (direction, comptable, responsable d'agence) ; l'exécution
      // (acte D'INSTITUTION) reste réservée à credit.delinquency.executer — l'écran gère déjà
      // la distinction, l'entrée de menu ne fait que l'ouvrir au plus large des deux.
      {
        etat: 'actif',
        libelle: M.entrees.reclassification,
        chemin: '/credit/reclassification',
        permission: ['credit.delinquency.read', 'credit.delinquency.executer'],
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
      // Produits d'épargne (chantier gestion des produits) : créer/valider/activer un produit
      // précède logiquement son rattachement comptable ci-dessous — placé juste avant. Lecture
      // ouverte à epargne.product.read, actions gérées par l'écran (epargne.product.manage).
      {
        etat: 'actif',
        libelle: M.entrees.produitsEpargne,
        chemin: '/epargne/produits',
        permission: 'epargne.product.read',
      },
      // Produits de crédit : symétrique de l'épargne, mais un SEUL écran à onglets (Produit +
      // Rattachements comptables) — le crédit n'avait pas encore les 2 blocs séparés que
      // l'épargne avait. Lecture ouverte à credit.product.read, chaque onglet gère lui-même
      // sa visibilité (compta.plan.read) et ses actions (credit.product.manage /
      // compta.plan.manage).
      {
        etat: 'actif',
        libelle: M.entrees.produitsCredit,
        chemin: '/credit/produits',
        permission: 'credit.product.read',
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
      // Caisse CA2 : seuil de tolérance sur l'écart — même paire de permissions (lecture de
      // route / gestion en écran) que les autres paramètres du Bloc 5.
      {
        etat: 'actif',
        libelle: M.entrees.parametresCaisse,
        chemin: '/comptabilite/parametres-caisse',
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
      // Saisie manuelle d'écriture (OD, chantier P1 lot 1) : lecture ouverte à
      // compta.ecriture.read — le brouillon/validation/contre-passation restent gardés à
      // l'écran lui-même (compta.ecriture.post/.reverse), comme les autres écrans sensibles.
      {
        etat: 'actif',
        libelle: M.entrees.ecrituresOD,
        chemin: '/comptabilite/ecritures-od',
        permission: 'compta.ecriture.read',
      },
      // Clôture d'exercice (chantier P1, lot b1) : consulter la liste ou l'aperçu de clôture
      // est déjà un acte de gestion sur ce périmètre, pas une simple lecture — une seule
      // permission pour tout l'écran, à la différence de l'OD (lecture/post/reverse séparés).
      {
        etat: 'actif',
        libelle: M.entrees.exercicesComptables,
        chemin: '/comptabilite/exercices',
        permission: 'compta.exercice.manage',
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
