/**
 * Tous les textes affichés par l'application, en un seul endroit.
 *
 * POURQUOI PAS DE TEXTE EN DUR DANS LES COMPOSANTS. L'application est en français
 * uniquement pour l'instant, et il serait tentant d'écrire les libellés là où ils
 * s'affichent. Mais une chaîne dispersée dans deux cents composants ne se traduit plus : il
 * faut relire chaque fichier pour la retrouver, et l'on en oublie toujours. Les regrouper
 * ici coûte un import et rend la traduction possible plus tard sans réécriture.
 *
 * POURQUOI PAS DE BIBLIOTHÈQUE i18n. Une seule langue, aucun pluriel dépendant du nombre,
 * aucune date localisée à ce stade : i18next apporterait une dépendance, un contexte React,
 * un chargement asynchrone et des clés de traduction à maintenir, pour un problème qu'on
 * n'a pas. La discipline suffit ; la bibliothèque viendra avec le second besoin réel.
 *
 * `as const` : les valeurs deviennent des types littéraux, donc une clé mal orthographiée
 * est une erreur de compilation, pas un « undefined » affiché à l'écran.
 */
export const LIBELLES = {
  application: {
    nom: 'Microfinance',
    sousTitre: 'Système d’information de gestion',
  },

  connexion: {
    titre: 'Connexion',
    instruction: 'Identifiez-vous pour accéder à votre espace de travail.',
    identifiant: 'Identifiant ou adresse électronique',
    identifiantAide: 'Votre identifiant de connexion, ou l’adresse enregistrée par votre administrateur.',
    motDePasse: 'Mot de passe',
    valider: 'Se connecter',
    validationEnCours: 'Connexion en cours…',

    // Champs vides : messages de FORME, avant tout appel réseau.
    identifiantRequis: 'Saisissez votre identifiant.',
    motDePasseRequis: 'Saisissez votre mot de passe.',
  },

  /**
   * Réponses du serveur à la connexion.
   *
   * Le message d'échec est VOLONTAIREMENT identique pour un compte inexistant, un mauvais
   * mot de passe et un compte désactivé — c'est le backend qui l'impose, et le front ne doit
   * surtout pas chercher à être plus précis : en distinguant ces cas, il révélerait qu'un
   * identifiant existe, ce que le serveur refuse justement de dire.
   */
  erreurs: {
    identifiantsIncorrects: 'Identifiant ou mot de passe incorrect.',

    compteVerrouille: 'Compte verrouillé',
    compteVerrouilleDetail: (echeance: string) =>
      `Trop de tentatives infructueuses. Votre compte sera de nouveau accessible ${echeance}.`,
    compteVerrouilleSansEcheance:
      'Trop de tentatives infructueuses. Votre compte est temporairement bloqué.',

    motDePasseARenouveler: 'Mot de passe à renouveler',
    motDePasseARenouvelerDetail:
      'Votre mot de passe doit être changé avant d’accéder à l’application.',

    // Panne réseau, backend arrêté, proxy mal configuré : l'utilisateur doit pouvoir
    // distinguer « mes identifiants sont mauvais » de « le service ne répond pas ».
    serveurInjoignable:
      'Le serveur ne répond pas. Vérifiez votre connexion, puis réessayez.',
    inattendue: 'Une erreur inattendue est survenue. Réessayez, puis contactez votre administrateur.',
  },

  motDePasse: {
    titreForce: 'Définissez un nouveau mot de passe',
    titreVolontaire: 'Changer mon mot de passe',

    // Ton DÉLIBÉRÉMENT rassurant : le renouvellement est une procédure normale (compte
    // neuf, ou mot de passe réinitialisé par un administrateur), pas une sanction. Un
    // message alarmant ferait croire à un incident et générerait des appels au support.
    instructionForce:
      'Pour votre sécurité, veuillez définir un nouveau mot de passe avant de continuer.',
    instructionVolontaire:
      'Choisissez un nouveau mot de passe. Vous devrez saisir votre mot de passe actuel pour confirmer.',

    actuel: 'Mot de passe actuel',
    nouveau: 'Nouveau mot de passe',
    confirmation: 'Confirmer le nouveau mot de passe',
    valider: 'Enregistrer le nouveau mot de passe',
    validationEnCours: 'Enregistrement…',
    annuler: 'Annuler',

    exigences: 'Votre mot de passe doit contenir :',
    regles: {
      longueur_minimale: 'au moins 12 caractères',
      majuscule_requise: 'une lettre majuscule',
      minuscule_requise: 'une lettre minuscule',
      chiffre_requis: 'un chiffre',
      caractere_special_requis: 'un caractère spécial (!, ?, @, #…)',
    },

    actuelRequis: 'Saisissez votre mot de passe actuel.',
    nouveauRequis: 'Saisissez le nouveau mot de passe.',
    confirmationRequise: 'Confirmez le nouveau mot de passe.',
    confirmationDifferente: 'Les deux mots de passe ne correspondent pas.',
    nonConforme: 'Le mot de passe ne respecte pas toutes les exigences ci-dessous.',

    // Les trois refus du serveur, distincts parce qu'ils appellent trois gestes différents.
    actuelIncorrect: 'Le mot de passe actuel est incorrect.',
    dejaUtilise:
      'Ce mot de passe a déjà été utilisé. Choisissez-en un différent des 12 derniers.',
    refuseParLaPolitique: 'Le serveur a refusé ce mot de passe :',

    succes: 'Votre mot de passe a été modifié.',
    // Cas où le changement a RÉUSSI mais où la session n'a pas pu être renouvelée. On
    // n'annonce jamais un échec sur une opération qui a abouti : l'utilisateur croirait
    // devoir recommencer, avec un ancien mot de passe qui ne fonctionne plus.
    succesReconnexionRequise:
      'Votre mot de passe a été modifié. Veuillez vous reconnecter avec le nouveau.',
  },

  navigation: {
    utilisateurLabel: 'Connecté',
    changerMotDePasse: 'Mot de passe',
    deconnexion: 'Se déconnecter',
  },

  utilisateurs: {
    titre: 'Utilisateurs',
    sousTitre: 'Comptes des employés de l’institution.',
    rechercher: 'Rechercher (nom, matricule, adresse électronique…)',

    colonneMatricule: 'Matricule',
    colonneNom: 'Nom',
    colonnePrenom: 'Prénom',
    // « Adresse électronique » et non « Adresse » : dans un logiciel de microfinance,
    // « adresse » seule évoque le domicile.
    colonneEmail: 'Adresse électronique',
    colonneAgence: 'Agence',
    colonneStatut: 'Statut',

    actif: 'Actif',
    inactif: 'Inactif',
    verrouille: 'Verrouillé',
    sansAgence: '—',

    total: (n: number) => (n <= 1 ? `${n} utilisateur` : `${n} utilisateurs`),
    page: (courante: number, sur: number) => `Page ${courante} sur ${sur}`,
    precedent: 'Précédent',
    suivant: 'Suivant',

    // Aucune ligne : deux causes distinctes, deux messages. Un tableau vide sans explication
    // laisse croire à une panne.
    aucunResultat: 'Aucun utilisateur ne correspond à votre recherche.',
    listeVide: 'Aucun utilisateur pour l’instant. Les comptes créés apparaîtront ici.',

    chargement: 'Chargement des utilisateurs…',
    interdit: 'Vous n’avez pas la permission de consulter les utilisateurs.',
    erreur: 'Impossible de charger la liste. Réessayez dans un instant.',
  },

  menu: {
    aVenir: 'Bientôt disponible',
    aVenirCourt: 'bientôt',

    groupes: {
      administration: 'Administration',
      clientele: 'Clientèle',
      operations: 'Opérations',
      comptabilite: 'Comptabilité',
      conformite: 'Conformité',
      pilotage: 'Pilotage',
      systeme: 'Système',
    },

    entrees: {
      utilisateurs: 'Utilisateurs',
      rolesHabilitations: 'Rôles et habilitations',
      journalAudit: 'Journal d’audit',
      parametrage: 'Paramétrage',
      tiers: 'Tiers (clients / membres)',
      caisseGuichet: 'Caisse / Guichet',
      epargneDepots: 'Épargne / Dépôts',
      credit: 'Crédit',
      recouvrement: 'Recouvrement',
      comptaGenerale: 'Comptabilité générale',
      comptaAnalytique: 'Comptabilité analytique',
      tresorerieImmo: 'Trésorerie et Immobilisations',
      reportingBceao: 'Reporting BCEAO',
      lbcFt: 'LBC/FT',
      decisionnel: 'Décisionnel',
      multiAgences: 'Multi-agences et Consolidation',
      canauxNumerique: 'Canaux alternatifs et Finance numérique',
      ged: 'GED',
    },
  },

  creation: {
    bouton: 'Créer un utilisateur',
    titre: 'Nouvel utilisateur',
    instruction: 'Le mot de passe provisoire sera généré et affiché une seule fois après création.',

    matricule: 'Matricule',
    nom: 'Nom',
    prenom: 'Prénom',
    identifiant: 'Identifiant de connexion',
    email: 'Adresse électronique',
    telephone: 'Téléphone',
    telephoneFacultatif: 'Téléphone (facultatif)',
    agence: 'Agence de rattachement',
    agenceChoisir: 'Choisir une agence…',

    creer: 'Créer le compte',
    creationEnCours: 'Création en cours…',
    annuler: 'Annuler',

    // Contraintes miroir du backend (schemas.py). Un formulaire qui accepte ce que le
    // serveur refuse renvoie l'utilisateur à un aller-retour inutile.
    matriculeRequis: 'Le matricule est obligatoire.',
    matriculeLong: 'Le matricule ne peut dépasser 30 caractères.',
    nomRequis: 'Le nom est obligatoire.',
    prenomRequis: 'Le prénom est obligatoire.',
    identifiantCourt: 'L’identifiant doit contenir au moins 3 caractères.',
    identifiantLong: 'L’identifiant ne peut dépasser 50 caractères.',
    emailRequis: 'L’adresse électronique est obligatoire.',
    emailInvalide: 'Adresse électronique invalide.',
    agenceRequise: 'Choisissez une agence de rattachement.',

    agencesIndisponibles: 'Impossible de charger la liste des agences.',

    // Erreurs du serveur à la création.
    conflit: 'Cet identifiant est déjà utilisé par un autre compte.',
    invalide: 'Certaines informations sont invalides. Corrigez les champs signalés.',
    interdit: 'Vous n’avez pas la permission de créer un utilisateur.',
  },

  motDePasseProvisoire: {
    // LE point le plus important de l'écran : ce mot de passe n'existe qu'ici, une fois.
    titre: 'Compte créé — notez le mot de passe provisoire',
    intro: (nom: string) => `Voici le mot de passe provisoire de ${nom}.`,
    avertissement:
      'Notez-le maintenant : il ne sera plus jamais affiché et n’est récupérable nulle part. Sans lui, le compte devra être réinitialisé pour être utilisable.',
    transmission:
      'Communiquez-le à la personne de vive voix ou sur papier. Elle devra le changer à sa première connexion.',
    copier: 'Copier',
    copie: 'Copié',
    confirmation: 'J’ai noté ce mot de passe et je peux le transmettre.',
    terminer: 'Terminer et revenir à la liste',
  },

  fiche: {
    retour: 'Retour à la liste',
    chargement: 'Chargement de la fiche…',
    introuvable: 'Cet utilisateur est introuvable.',
    erreur: 'Impossible de charger la fiche. Réessayez dans un instant.',

    // Champs
    matricule: 'Matricule',
    identifiant: 'Identifiant de connexion',
    email: 'Adresse électronique',
    telephone: 'Téléphone',
    agence: 'Agence de rattachement',
    statut: 'Statut',
    verrouillage: 'Verrouillage',
    motDePasse: 'Mot de passe',
    creeLe: 'Créé le',
    modifieLe: 'Dernière modification',
    sansValeur: '—',

    actif: 'Actif',
    inactif: 'Inactif',
    nonVerrouille: 'Non verrouillé',
    verrouilleJusqua: (echeance: string) => `Verrouillé jusqu’au ${echeance}`,
    renouvellementRequis: 'Changement de mot de passe requis à la prochaine connexion',
    renouvellementNonRequis: 'À jour',

    // Actions
    modifier: 'Modifier',
    desactiver: 'Désactiver',
    reactiver: 'Réactiver',
    deverrouiller: 'Déverrouiller',
    reinitialiser: 'Réinitialiser le mot de passe',
    supprimer: 'Supprimer',

    // Sur soi-même
    surSoiMeme: 'Vous ne pouvez pas effectuer cette action sur votre propre compte.',

    // Confirmations
    confirmer: 'Confirmer',
    annuler: 'Annuler',

    desactiverTitre: 'Désactiver ce compte ?',
    desactiverAvertissement:
      'Cette personne sera immédiatement déconnectée : toutes ses sessions seront révoquées. Elle ne pourra plus se connecter tant que le compte n’est pas réactivé.',

    reinitialiserTitre: 'Réinitialiser le mot de passe ?',
    reinitialiserAvertissement:
      'Un nouveau mot de passe provisoire sera généré et affiché une seule fois. Toutes les sessions de la personne seront révoquées : elle sera déconnectée immédiatement.',

    supprimerTitre: 'Supprimer cet utilisateur ?',
    supprimerAvertissement:
      'La personne sort de l’annuaire et ne pourra plus se connecter. C’est une suppression logique : l’historique d’audit est conservé, mais l’opération n’est pas destinée à être annulée depuis l’application.',
    supprimerConfirmer: 'Supprimer définitivement',

    // Erreurs d'action
    actionInterdite: 'Vous n’avez pas la permission d’effectuer cette action.',
    actionIntrouvable: 'Cet utilisateur n’existe pas dans votre périmètre.',
    actionConflit: 'Cette adresse électronique est déjà utilisée par un autre compte.',
    actionInvalide: 'Certaines informations sont invalides. Corrigez les champs signalés.',
    actionErreur: 'L’action a échoué. Réessayez dans un instant.',
  },

  modification: {
    titre: 'Modifier la fiche',
    nom: 'Nom',
    prenom: 'Prénom',
    email: 'Adresse électronique',
    telephone: 'Téléphone (facultatif)',
    // Rappel visible : ces deux clés ne se modifient pas.
    identifiantsFixes: 'Le matricule et l’identifiant de connexion ne sont pas modifiables.',
    enregistrer: 'Enregistrer',
    enregistrementEnCours: 'Enregistrement…',
    annuler: 'Annuler',

    nomRequis: 'Le nom est obligatoire.',
    prenomRequis: 'Le prénom est obligatoire.',
    emailRequis: 'L’adresse électronique est obligatoire.',
    emailInvalide: 'Adresse électronique invalide.',
  },

  roles: {
    titre: 'Rôles',
    sousTitre: 'Les rôles déterminent ce que la personne peut faire dans l’application.',
    aucun: 'Aucun rôle attribué. Ce compte ne peut rien faire tant qu’un rôle ne lui est pas donné.',
    retirer: 'Retirer',
    ajouter: 'Ajouter un rôle',
    choisir: 'Choisir un rôle…',
    attribuer: 'Attribuer',

    // Sur sa propre fiche : lecture seule.
    lectureSeule: 'Vous ne pouvez pas modifier vos propres rôles (séparation des pouvoirs).',

    // Erreurs propres à l'attribution.
    dejaAttribue: 'Cette personne détient déjà ce rôle.',
    rolesIndisponibles: 'Impossible de charger la liste des rôles.',
    erreur: 'L’opération sur les rôles a échoué. Réessayez.',
  },

  session: {
    expiree: 'Votre session a expiré. Veuillez vous reconnecter.',
    deconnexion: 'Se déconnecter',
  },

  chargement: 'Chargement…',
} as const
