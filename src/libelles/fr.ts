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
      guichetEpargne: 'Guichet',
      versementInterets: 'Versement des intérêts',
      rapprochementEpargne: 'Rapprochement épargne',
      planComptable: 'Plan de comptes',
      rattachementsEpargne: 'Rattachements épargne',
      rattachementsCaisse: 'Caisse par agence',
      parametresParts: 'Paramètres des parts sociales',
      epargneDepots: 'Épargne / Dépôts',
      credit: 'Crédit',
      recouvrement: 'Recouvrement',
      grandLivre: 'Grand livre',
      balance: 'Balance',
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

  accueil: {
    bienvenue: (nom: string) => `Bienvenue, ${nom}.`,
    // Compte sans aucun rôle : message CALME et informatif, jamais une erreur rouge. La
    // personne vient de se connecter, elle n'a rien fait de mal — elle attend juste ses
    // accès.
    sansRole:
      'Votre compte n’a pas encore de rôle attribué. Contactez votre administrateur pour obtenir vos accès.',
    // A des rôles mais aucun écran encore disponible pour eux.
    aucunEcran:
      'Les écrans correspondant à votre rôle seront accessibles depuis le menu, à mesure des prochains modules.',
  },

  audit: {
    titre: 'Journal d’audit',
    sousTitre: 'Trace inviolable des opérations sensibles. Consultation en lecture seule.',

    colonneDate: 'Date et heure',
    colonneAction: 'Action',
    colonneActeur: 'Auteur',
    colonneCible: 'Personne concernée',
    colonneDetail: 'Détail',

    voirDetail: 'Voir',
    masquerDetail: 'Masquer',
    avant: 'Avant',
    apres: 'Après',
    adresseIp: 'Adresse IP',
    systeme: 'Système',
    sansValeur: '—',

    // Filtres
    filtreAction: 'Type d’action',
    filtreActionToutes: 'Toutes les actions',
    filtreDateDebut: 'Depuis le',
    filtreDateFin: 'Jusqu’au',
    reinitialiser: 'Réinitialiser les filtres',

    total: (n: number) => (n <= 1 ? `${n} entrée` : `${n} entrées`),
    page: (courante: number, sur: number) => `Page ${courante} sur ${sur}`,
    precedent: 'Précédent',
    suivant: 'Suivant',

    chargement: 'Chargement du journal…',
    aucuneEntree: 'Aucune entrée ne correspond à ces critères.',
    interdit: 'Vous n’avez pas la permission de consulter le journal d’audit.',
    erreur: 'Impossible de charger le journal. Réessayez dans un instant.',

    // TABLE DE CORRESPONDANCE — le point qui rend l'écran lisible pour un directeur ou un
    // auditeur. Le journal stocke des codes techniques ; on ne les montre JAMAIS bruts.
    // Doit rester alignée sur les actions écrites côté backend (ActionUtilisateur,
    // ActionAudit) : une action non traduite retomberait sur son code — visible et laid.
    actions: {
      'user.created': 'Création d’un utilisateur',
      'user.updated': 'Modification d’une fiche utilisateur',
      'user.deactivated': 'Désactivation d’un compte',
      'user.activated': 'Réactivation d’un compte',
      'user.deleted': 'Suppression d’un utilisateur',
      'user.unlocked': 'Déverrouillage d’un compte',
      'user.password_reset': 'Réinitialisation d’un mot de passe',
      'user.role_assigned': 'Attribution d’un rôle',
      'user.role_removed': 'Retrait d’un rôle',
      'auth.login.success': 'Connexion réussie',
      'auth.account.locked': 'Verrouillage du compte (tentatives échouées)',
      'auth.token.reuse_detected': 'Réutilisation de jeton détectée',
      'auth.token.refresh_denied_account_unavailable': 'Rafraîchissement refusé (compte indisponible)',
      'auth.login.agency_denied': 'Connexion refusée (agence non autorisée)',
    } as Record<string, string>,
  },

  tiers: {
    titre: 'Tiers (clients / membres)',
    sousTitre: 'Personnes physiques, morales et groupements en relation avec l’institution.',

    colonneNumero: 'Numéro',
    colonneNom: 'Nom',
    colonneType: 'Type',
    colonneAgence: 'Agence',
    colonneStatut: 'Statut',
    colonneSocietariat: 'Sociétariat',
    sansAgence: '—',

    // Sociétariat (marqueur membre/client, 0025) — dimension distincte du statut.
    societariat: { membre: 'Membre', client: 'Client' } as Record<string, string>,

    rechercher: 'Rechercher — numéro ou nom',
    afficherDesactives: 'Afficher les fiches désactivées',
    total: (n: number) => (n <= 1 ? `${n} tiers` : `${n} tiers`),
    page: (courante: number, sur: number) => `Page ${courante} sur ${sur}`,
    precedent: 'Précédent',
    suivant: 'Suivant',

    chargement: 'Chargement des tiers…',
    listeVide: 'Aucun tiers enregistré pour le moment.',
    aucunResultat: 'Aucun tiers ne correspond à cette recherche.',
    interdit: 'Vous n’avez pas la permission de consulter les tiers.',
    erreur: 'Impossible de charger les tiers. Réessayez dans un instant.',
    introuvable: 'Ce tiers est introuvable, ou hors de votre périmètre.',

    // Codes techniques -> français. Alignés sur les valeurs du backend (tier_type, status,
    // event_type). Une valeur non traduite retomberait sur son code, visible et laid.
    types: {
      individual: 'Personne physique',
      legal_entity: 'Personne morale',
      group: 'Groupement',
    } as Record<string, string>,
    statuts: {
      prospect: 'Prospect',
      actif: 'Actif',
      suspendu_temporaire: 'Suspendu',
      suspendu_lcb: 'Suspendu (LBC/FT)',
      desactive: 'Désactivé',
      decede: 'Décédé',
      dissous: 'Dissous',
      fusionne: 'Fusionné',
    } as Record<string, string>,
    evenements: {
      created: 'Création de la fiche',
      updated: 'Modification',
      activated: 'Activation',
      suspended: 'Suspension',
      reactivated: 'Réactivation',
      deactivated: 'Désactivation',
      restored: 'Réactivation',
      marked_deceased: 'Décès enregistré',
      marked_dissolved: 'Dissolution enregistrée',
      merged: 'Fusion de fiches',
    } as Record<string, string>,
  },

  tiersCreation: {
    bouton: 'Nouveau tiers',
    titre: 'Nouveau tiers',
    instruction: 'La fiche naîtra en statut « prospect », en attente de validation KYC.',

    typeQuestion: 'Type de tiers',
    typePhysique: 'Personne physique',
    typeMorale: 'Personne morale',
    typeGroupement: 'Groupement',
    typePhysiqueAide: 'Un membre ou client individuel.',
    typeMoraleAide: 'Une entreprise, association, coopérative ou ONG.',
    typeGroupementAide: 'Un groupement solidaire (caution solidaire, tontine…).',

    // Champs communs
    telephone: 'Téléphone (facultatif)',
    agence: 'Agence de rattachement',
    agenceChoisir: 'Choisir une agence…',
    agencesIndisponibles: 'Impossible de charger la liste des agences.',

    // Personne physique
    nom: 'Nom',
    prenom: 'Prénom',
    dateNaissance: 'Date de naissance',
    sexe: 'Sexe',
    sexeChoisir: 'Choisir…',
    sexeM: 'Masculin',
    sexeF: 'Féminin',
    nationalite: 'Nationalité',
    nationaliteChoisir: 'Choisir un pays…',
    profession: 'Profession (facultatif)',

    // Personne morale
    raisonSociale: 'Dénomination sociale',
    formeJuridique: 'Forme juridique',
    formeChoisir: 'Choisir…',
    dateConstitution: 'Date de constitution',
    siege: 'Pays du siège',
    capital: 'Capital social (facultatif)',
    devise: 'Devise',
    deviseChoisir: 'Choisir…',

    // Groupement
    nomGroupement: 'Nom du groupement',
    typeGroupementLabel: 'Type de groupement',
    typeGroupementChoisir: 'Choisir…',

    creer: 'Créer la fiche',
    creationEnCours: 'Création en cours…',
    annuler: 'Annuler',

    // Validation (miroir des bornes backend)
    requis: 'Ce champ est obligatoire.',
    trop_long: 'Valeur trop longue.',
    dateInvalide: 'Date invalide.',
    dateFuture: 'La date ne peut pas être dans le futur.',
    paysIndisponibles: 'Impossible de charger la liste des pays.',

    // Erreurs serveur
    conflit: 'Un tiers avec ces identifiants existe déjà.',
    invalide: 'Certaines informations sont invalides. Corrigez les champs signalés.',
    reference: 'Une donnée de référence (agence, pays) est invalide.',
    interdit: 'Vous n’avez pas la permission de créer un tiers.',

    formesJuridiques: {
      SA: 'SA — Société anonyme',
      SARL: 'SARL — Société à responsabilité limitée',
      SAS: 'SAS — Société par actions simplifiée',
      SNC: 'SNC — Société en nom collectif',
      GIE: 'GIE — Groupement d’intérêt économique',
      ASSOCIATION: 'Association',
      COOPERATIVE: 'Coopérative',
      ONG: 'ONG',
      EI: 'Entreprise individuelle',
      AUTRE: 'Autre',
    } as Record<string, string>,
    typesGroupement: {
      caution_solidaire: 'Caution solidaire',
      tontine: 'Tontine',
      association_locale: 'Association locale',
      cooperative_villageoise: 'Coopérative villageoise',
      autre: 'Autre',
    } as Record<string, string>,
  },

  tiersFiche: {
    retour: 'Retour à la liste',
    numero: 'Numéro',
    type: 'Type',
    statut: 'Statut',
    agence: 'Agence',
    telephone: 'Téléphone',
    profession: 'Profession',
    dateNaissance: 'Date de naissance',
    sexe: 'Sexe',
    nationalite: 'Nationalité',
    raisonSociale: 'Dénomination sociale',
    formeJuridique: 'Forme juridique',
    dateConstitution: 'Date de constitution',
    nomGroupement: 'Nom du groupement',
    typeGroupement: 'Type de groupement',
    creeLe: 'Créé le',

    identite: 'Identité',
    timeline: 'Frise chronologique',
    timelineVide: 'Aucun événement enregistré.',

    // Le statut prospect, expliqué — on montre l'ÉTAT RÉEL (ce qui reste à compléter), pas un
    // texte figé. Les conditions viennent du backend (GET activation-conditions).
    prospectTitre: 'Fiche en attente d’activation',
    prospectPret: 'Toutes les conditions de dossier sont réunies : cette fiche peut être activée.',
    prospectACompleter: 'Pour activer cette fiche, complétez :',
    prospectChargement: 'Vérification des conditions d’activation…',

    // Vue limitée (read.basic) : ce que voit un caissier, sans détail ni frise.
    vueLimitee: 'Vue limitée',
    vueLimiteeAide:
      'Vous voyez l’identification de ce tiers. Le détail complet est réservé aux profils habilités.',

    // Fiche désactivée (sortie de l'annuaire) : visible seulement pour la supervision.
    desactiveeTitre: 'Fiche désactivée',
    desactiveeAide:
      'Cette fiche est sortie de l’annuaire (désactivée). Elle n’apparaît plus dans les listes courantes. Un responsable peut la réactiver — elle repartira en prospect, à re-valider.',

    chargement: 'Chargement de la fiche…',
    sansValeur: '—',
    systeme: 'Système',
  },

  tiersActions: {
    titre: 'Actions',

    activer: 'Activer',
    suspendre: 'Suspendre',
    reactiver: 'Réactiver',
    marquerDecede: 'Enregistrer le décès',
    marquerDissous: 'Enregistrer la dissolution',
    desactiver: 'Désactiver',

    motif: 'Motif (facultatif)',
    motifPlaceholder: 'Ex. : pièce d’identité à régulariser',
    annuler: 'Annuler',
    fermer: 'Fermer',

    suspendreTitre: 'Suspendre cette fiche ?',
    suspendreAvert:
      'La fiche ne pourra plus effectuer d’opérations tant qu’elle est suspendue. L’action est réversible.',
    suspendreConfirmer: 'Suspendre',

    reactiverTitre: 'Réactiver cette fiche ?',
    reactiverAvert: 'La fiche redevient active et peut à nouveau opérer.',
    reactiverConfirmer: 'Réactiver',

    decedeTitre: 'Enregistrer le décès ?',
    decedeAvert:
      'La fiche passera en statut « décédé ». Elle RESTE consultable — il y a une succession, une épargne à liquider.',
    decedeConfirmer: 'Enregistrer le décès',

    dissousTitre: 'Enregistrer la dissolution ?',
    dissousAvert: 'La fiche passera en statut « dissous ». Elle reste consultable.',
    dissousConfirmer: 'Enregistrer la dissolution',

    desactiverTitre: 'Désactiver cette fiche ?',
    desactiverAvert:
      'ATTENTION — la fiche va SORTIR de l’annuaire : elle disparaîtra des listes et personne ne la verra plus. À ne faire que si le tiers n’a aucune opération (épargne, crédit) en cours.',
    desactiverConfirmer: 'Désactiver définitivement',

    // Restauration d'une fiche désactivée : on énonce clairement ce qui va se passer.
    reactiverFiche: 'Réactiver la fiche',
    reactiverFicheTitre: 'Réactiver cette fiche désactivée ?',
    reactiverFicheAvert:
      'La fiche reviendra dans l’annuaire en statut « prospect » — PAS active. Elle devra repasser la validation KYC avant toute opération : un ancien membre qui revient n’est pas automatiquement re-vérifié.',
    reactiverFicheConfirmer: 'Réactiver (retour en prospect)',
    voirFicheConflit: 'Voir la fiche',

    // Activation refusée : on affiche TOUTES les conditions manquantes (conception T1e/T3),
    // pas un message générique.
    activationTitre: 'Activation impossible pour l’instant',
    activationIntro: 'L’activation requiert que toutes ces conditions soient remplies :',
    activationEnCours: 'Vérification des conditions…',

    // Désactivation bloquée par des engagements — MÊME motif que l'activation : on affiche ce qui
    // bloque et QUOI faire, et on n'offre pas de bouton qui échouerait. Le bouton revient quand il
    // n'y a plus d'engagement.
    desactiverBloqueTitre: 'Désactivation impossible pour l’instant',
    desactiverBloqueIntro: 'Réglez d’abord ces engagements :',
    desactiverVerification: 'Vérification des engagements…',

    erreur: 'L’action a échoué. Réessayez dans un instant.',
    interdit: 'Vous n’avez pas la permission d’effectuer cette action.',
  },

  tiersOnglets: {
    coordonnees: 'Coordonnées',
    pieces: 'Pièces d’identité',
    kyc: 'KYC / Risque',
    epargne: 'Comptes d’épargne',
    parts: 'Parts sociales',
    frise: 'Historique',
  },

  tiersParts: {
    chargement: 'Chargement des parts sociales…',
    erreur: 'Impossible de charger les parts sociales.',
    aucune: 'Ce tiers ne détient aucune part sociale.',

    // Capital et parts détenues.
    capitalLibere: 'Capital libéré',
    capitalNonLibere: 'À libérer',
    partsLiberees: (n: number) => (n <= 1 ? `${n} part libérée` : `${n} parts libérées`),
    partsNonLiberees: (n: number) =>
      n <= 1 ? `${n} part souscrite non libérée` : `${n} parts souscrites non libérées`,

    // Barème PROVISOIRE (comme le taux d'épargne / le barème KYC).
    baremeTitre: 'Barème des parts',
    valeurPart: 'Valeur d’une part',
    minimum: 'Minimum pour adhérer',
    minimumValeur: (n: number) => (n <= 1 ? `${n} part` : `${n} parts`),
    provisoireAide:
      'Valeur d’une part et minimum non encore validés par l’expert / les statuts : valeurs non réglementaires confirmées.',

    // Cas LISIBLE : client qui détient encore des parts (remboursement partiel sous le minimum).
    // {parts} et {capital} injectés.
    ancienSocietaire:
      'N’est plus sociétaire (sous le minimum), mais détient encore {parts} — capital {capital}. Non désactivable tant qu’elles ne sont pas remboursées.',

    // Historique.
    historique: 'Historique des parts',
    historiqueVide: 'Aucun mouvement de parts.',
    piece: 'Pièce',
    operations: {
      souscription: 'Souscription (engagement)',
      liberation: 'Libération',
      souscription_comptant: 'Souscription au comptant',
      remboursement: 'Remboursement',
      annulation: 'Annulation',
    } as Record<string, string>,

    // --- Actions (bloc 2) : souscrire / libérer = « devenir membre » ---
    // Réservé au tiers ACTIF ; sinon on l'explique (comme le gate KYC de l'épargne).
    gateNonActif:
      'Ce tiers doit être actif (dossier validé) avant de souscrire des parts sociales.',
    // Le geste central, guidé : combien de parts -> total à payer -> confirmer.
    actionComptant: 'Souscrire au comptant (devenir membre)',
    actionComptantAide:
      'Le membre souscrit ET paie ses parts en une fois au guichet : il devient sociétaire immédiatement.',
    actionEngagement: 'Souscrire (engagement, à libérer ensuite)',
    actionEngagementAide:
      'Enregistre l’engagement du membre sans paiement. Il deviendra sociétaire à la libération.',
    actionLiberer: 'Libérer des parts (encaisser)',
    actionLibererAide:
      'Le membre paie des parts déjà souscrites : le capital devient réel, il devient sociétaire.',
    nbParts: 'Nombre de parts',
    nbPartsPlaceholder: 'Ex. 10',
    // {parts}, {valeur}, {total} injectés.
    totalAPayer: '{parts} parts × {valeur} = {total} à encaisser',
    totalSouscrit: '{parts} parts × {valeur} = {total} souscrits',
    continuer: 'Continuer',
    // Confirmation — on répète le geste et son effet.
    confirmerComptant: 'Encaisser {total} et rendre ce tiers MEMBRE ?',
    confirmerEngagement: 'Enregistrer la souscription de {parts} parts (sans paiement) ?',
    confirmerLiberation: 'Encaisser {total} pour libérer {parts} parts ?',
    confirmer: 'Confirmer',
    enCours: 'Traitement…',
    annuler: 'Annuler',
    // Succès — le badge a basculé, on le dit.
    succesMembre: 'Fait. Ce tiers est désormais MEMBRE (sociétaire).',
    succesEngagement: 'Souscription enregistrée. À libérer pour devenir membre.',
    autreOperation: 'Nouvelle opération',
    echec: 'L’opération a échoué. Réessayez.',

    // --- Remboursement / annulation (bloc 3, responsable) ---
    actionRembourser: 'Rembourser des parts',
    actionRembourserAide:
      'Rendre au membre le capital de ses parts libérées. Remboursement total = il quitte le sociétariat et redevient client.',
    actionAnnuler: 'Annuler une souscription non libérée',
    // Montant restitué AFFICHÉ avant de confirmer (on ne rembourse pas à l'aveugle).
    // {parts}, {total} injectés.
    restitution: '{total} seront restitués au membre pour {parts} parts.',
    confirmerRemboursement: 'Restituer {total} et retirer {parts} parts ?',
    confirmerRemboursementTotal:
      'Restituer {total} : ce membre récupère tout son capital et redevient CLIENT. Confirmer ?',
    confirmerAnnulation: 'Annuler {parts} parts souscrites non libérées (aucun mouvement d’argent) ?',
    succesRembourse: 'Capital restitué.',
    succesRedevientClient: 'Capital restitué. Ce tiers redevient CLIENT (a quitté le sociétariat).',
    // Résiduel après remboursement partiel — lisible.
    // {parts}, {capital} injectés.
    residuel: 'Capital restant : {capital} ({parts}).',
  },

  epargne: {
    titre: 'Comptes d’épargne',
    chargement: 'Chargement des comptes…',
    erreur: 'Impossible de charger les comptes d’épargne.',
    vide: 'Aucun compte d’épargne.',
    ouvrir: 'Ouvrir un compte',
    // Gate KYC visible : on explique POURQUOI le bouton d’ouverture est absent.
    gateNonActif:
      'Ce membre doit être activé (KYC validé) avant de pouvoir ouvrir un compte d’épargne. Un prospect n’y a pas droit.',
    produit: 'Produit d’épargne',
    produitChoisir: 'Choisir un produit…',
    produitProvisoireSuffixe: '(provisoire)',
    confirmerOuverture: 'Ouvrir le compte',
    ouvertureEnCours: 'Ouverture…',
    annuler: 'Annuler',
    ouvertureEchec: 'L’ouverture a échoué. Réessayez.',
    statuts: { actif: 'Ouvert', cloture: 'Fermé' } as Record<string, string>,
    provisoire: 'provisoire',
    provisoireAide:
      'Rattachement comptable et/ou taux non encore validés par l’expert : valeur non réglementaire confirmée.',

    // Panneau compte : relevé + fermeture (F3).
    chargementReleve: 'Chargement du relevé…',
    releve: 'Relevé des mouvements',
    releveVide: 'Aucun mouvement.',
    operations: {
      depot: 'Dépôt',
      retrait: 'Retrait',
      interet: 'Intérêts',
      cloture: 'Clôture (restitution)',
    } as Record<string, string>,
    piece: 'Pièce',
    fermer: 'Fermer le compte',
    // La restitution est PROÉMINENTE avant de confirmer — on ne ferme pas à l'aveugle.
    fermetureRestitution: 'Le solde de {montant} sera restitué au membre.',
    fermetureSoldeNul: 'Ce compte est vide : il sera simplement fermé.',
    fermerConfirmer: 'Confirmer la fermeture',
    fermetureEnCours: 'Fermeture…',
    fermetureEchec: 'La fermeture a échoué. Réessayez.',
    // La boucle rendue LISIBLE : après fermeture, plus de blocage à la désactivation.
    desactivable: 'Ce membre n’a plus de compte d’épargne ouvert : il peut être désactivé.',
  },

  interets: {
    titre: 'Versement des intérêts',
    intro:
      'Choisissez une période, prévisualisez, puis versez. Rien n’est versé tant que vous n’avez pas confirmé.',

    // Réservé à la direction (acte d'institution). Message si on n'a pas le droit — mais la
    // route le garde déjà en amont, ceci est une ceinture supplémentaire.
    periodeLabel: 'Période (libellé)',
    periodePlaceholder: 'Ex. : 2026-S1',
    periodeAide:
      'Le libellé identifie la période et empêche un double versement : la même période ne peut être versée deux fois.',
    debutLabel: 'Du',
    finLabel: 'Au',
    previsualiser: 'Prévisualiser',
    previsualisationEnCours: 'Calcul en cours…',

    // Prévisualisation : le TOTAL et le DÉTAIL, avant tout versement.
    apercuTitre: 'Prévisualisation — rien n’est encore versé',
    // {comptes} et {total} injectés.
    apercuResume: '{comptes} comptes concernés, total à verser : {total}',
    apercuPeriode: 'Période du {debut} au {fin} ({jours} jours)',

    // Rien à verser : on ne reste JAMAIS muet — on affiche un titre ET la raison précise.
    apercuAucunTitre: 'Aucun intérêt à verser sur cette période',
    raisonTauxZero:
      'Les produits d’épargne sont à taux 0 : le barème n’a pas encore été fixé par l’expert. Posez un taux avant de verser.',
    raisonAucunCompte:
      'Aucun compte d’épargne actif à traiter pour cette période.',
    raisonSoldes:
      'Les comptes actifs n’ont pas de solde rémunérable sur cette période (soldes insuffisants ou aucun mouvement).',
    // Champs incomplets : le clic ne doit pas rester sans effet.
    saisieIncomplete: 'Renseignez la période (libellé) et les deux dates avant de prévisualiser.',
    // Provisoire : le barème (taux/méthode) n'est pas validé.
    provisoireBanniere:
      'Barème PROVISOIRE : le taux et la méthode de calcul ne sont pas encore validés par l’expert. Vérifiez le détail ci-dessous avant de verser.',

    // Déjà versé (anti-double) : on le DIT clairement, on n'échoue pas en silence.
    dejaVerseTitre: 'Intérêts déjà versés pour cette période',
    // {date} injectée.
    dejaVerseDetail:
      'Cette période a déjà été traitée le {date}. Aucun nouveau versement ne sera fait.',
    dejaTraites: '{n} comptes déjà versés.',

    // Le détail par compte : de quoi vérifier « ça a l'air juste ».
    detailTitre: 'Détail (échantillon)',
    colCompte: 'Compte',
    colProduit: 'Produit',
    colTaux: 'Taux',
    colMethode: 'Méthode',
    colBase: 'Base de calcul',
    colMontant: 'Intérêt',
    methodes: {
      min_periode: 'Solde minimum de la période',
      moyen_quotidien: 'Solde moyen quotidien',
      fin_periode: 'Solde en fin de période',
    } as Record<string, string>,

    // Confirmation RENFORCÉE (comme la désactivation) : on crée de l'argent sur des comptes.
    confirmerTitre: 'Confirmer le versement des intérêts ?',
    // {comptes} et {total} injectés.
    confirmerAvert:
      'Vous allez verser {total} sur {comptes} comptes. Cette opération crédite l’argent sur les comptes des membres et passe les écritures comptables. Elle ne s’annule pas d’un clic.',
    confirmer: 'Verser les intérêts',
    versementEnCours: 'Versement en cours…',
    annuler: 'Annuler',
    recommencer: 'Nouvelle période',

    // Résultat.
    succesTitre: 'Versement effectué',
    // {credites} et {total} injectés.
    succesDetail: '{credites} comptes crédités, pour un total de {total}.',
    succesRienAVerser:
      'Aucun compte n’a été crédité (période déjà versée, ou aucun intérêt dû).',

    echec: 'Le versement a échoué. Réessayez, puis prévenez votre administrateur.',
    champsRequis: 'Renseignez la période et les deux dates.',
  },

  rapprochement: {
    titre: 'Rapprochement épargne ↔ comptabilité',
    intro:
      'Pour chaque compte collectif : la somme des soldes d’épargne (auxiliaire) face au solde comptable (général). Ils doivent concorder.',
    chargement: 'Chargement du rapprochement…',
    erreur: 'Impossible de charger le rapprochement. Réessayez dans un instant.',
    vide: 'Aucun compte collectif à rapprocher pour l’instant.',

    colCompte: 'Compte collectif',
    colAuxiliaire: 'Auxiliaire (Σ soldes)',
    colGeneral: 'Général (comptabilité)',
    colEtat: 'État',

    concordant: 'Concordant',
    // {montant} injecté (valeur absolue de l'écart).
    ecart: 'Écart : {montant}',
    // Bandeau de synthèse : tout va bien, ou il y a au moins un écart à traiter.
    toutConcordant: 'Tous les comptes concordent.',
    ecartsDetectes:
      'Au moins un écart détecté. Un écart entre l’auxiliaire et le général est le premier signe d’une anomalie : à investiguer.',
  },

  guichet: {
    // Titre générique de l'écran à ONGLETS (Épargne / Parts sociales) — un seul poste, deux
    // encaissements possibles, pas de navigation entre deux écrans pendant qu'un client attend.
    titre: 'Guichet',
    ongletEpargne: 'Épargne',
    ongletParts: 'Parts sociales',

    intro: 'Saisissez le numéro du livret pour trouver le compte, puis opérez.',
    numeroLabel: 'Numéro de compte',
    numeroPlaceholder: 'EP-2026-0000001',
    chercher: 'Chercher',
    rechercheEnCours: 'Recherche…',
    introuvable: 'Aucun compte à ce numéro dans votre agence. Vérifiez le numéro.',
    // Vérification humaine : le nom est proéminent, on confirme « c'est bien la personne ».
    membre: 'Titulaire',
    solde: 'Solde',
    compteFerme: 'Ce compte est fermé : aucune opération possible.',
    depot: 'Dépôt',
    retrait: 'Retrait',
    montantLabel: 'Montant (F)',
    montantPlaceholder: 'Ex. 10000',
    continuer: 'Continuer',
    // Confirmation renforcée — le nom du titulaire est répété.
    confirmerDepot: 'Déposer {montant} sur {numero}',
    confirmerRetrait: 'Retirer {montant} de {numero}',
    confirmerQuestion: 'Confirmez-vous l’opération pour {membre} ?',
    confirmer: 'Confirmer',
    annuler: 'Annuler',
    enCours: 'Traitement…',
    succesDepot: 'Dépôt de {montant} enregistré. Pièce {piece}. Nouveau solde : {solde}.',
    succesRetrait: 'Retrait de {montant} enregistré. Pièce {piece}. Nouveau solde : {solde}.',
    echec: 'L’opération a échoué. Réessayez.',
    autreOperation: 'Nouvelle opération',
  },

  // Onglet « Parts sociales » du guichet — l'encaissement du caissier (comptant / libération).
  // Le vocabulaire des actions (confirmations, succès, barème) est PARTAGÉ avec tiersParts —
  // même geste, même mot, qu'on le fasse depuis la fiche ou depuis le guichet.
  guichetParts: {
    intro: 'Cherchez un tiers par numéro ou nom, puis encaissez.',
    rechercherLabel: 'Numéro ou nom',
    rechercherPlaceholder: 'M-2026-0000001 ou nom',
    chercher: 'Chercher',
    rechercheEnCours: 'Recherche…',
    aucunResultat: 'Aucun tiers ne correspond à cette recherche.',
    changerRecherche: 'Nouvelle recherche',
    // Vérification humaine : le nom est proéminent, comme au guichet épargne.
    tiers: 'Tiers',

    // Confirmations — le NOM est RÉPÉTÉ (même règle qu'au guichet épargne : {montant} sur
    // {numero}, puis « Confirmez-vous… {membre} »). {parts}, {total}, {nom} injectés.
    confirmerComptant: 'Encaisser {total} et faire adhérer {nom} ({parts} parts) ?',
    confirmerLiberation: 'Encaisser {total} pour libérer {parts} parts de {nom} ?',
  },

  planComptable: {
    titre: 'Plan de comptes',
    sousTitre: 'Les comptes du plan RCSFD — consultation et gestion.',
    rechercher: 'Rechercher — numéro ou libellé',
    filtreClasse: 'Classe',
    toutesClasses: 'Toutes les classes',
    afficherInactifs: 'Afficher les comptes désactivés',
    nouveauCompte: 'Nouveau compte',

    colonneNumero: 'Numéro',
    colonneLibelle: 'Libellé',
    colonneClasse: 'Classe',
    colonneSens: 'Sens',
    colonneNature: 'Nature',
    colonneStatut: 'Statut',

    total: (n: number) => (n <= 1 ? `${n} compte` : `${n} comptes`),
    page: (courante: number, sur: number) => `Page ${courante} sur ${sur}`,
    precedent: 'Précédent',
    suivant: 'Suivant',

    chargement: 'Chargement du plan de comptes…',
    listeVide: 'Aucun compte pour le moment.',
    aucunResultat: 'Aucun compte ne correspond à cette recherche.',
    interdit: 'Vous n’avez pas la permission de consulter le plan de comptes.',
    erreur: 'Impossible de charger le plan de comptes. Réessayez dans un instant.',
    introuvable: 'Ce compte est introuvable.',

    sens: { D: 'Débit', C: 'Crédit' } as Record<string, string>,
    nature: { posting: 'Saisie', regroupement: 'Regroupement' } as Record<string, string>,
    systeme: 'Système',
    provisoire: 'provisoire',
    provisoireAide: 'Compte importé du modèle générique, non encore validé par l’expert.',
    actif: 'Actif',
    inactif: 'Désactivé',

    // Création — formulaire inline (comme l'ouverture d'un compte d'épargne).
    creationNumero: 'Numéro de compte',
    creationNumeroPlaceholder: 'Ex. 6033',
    creationLibelle: 'Libellé',
    creationLibelleCourt: 'Libellé court (facultatif)',
    creationClasse: 'Classe',
    creationParent: 'Compte parent (facultatif)',
    creationParentPlaceholder: 'Ex. 60 — laisser vide si aucun',
    creationSens: 'Sens normal',
    creationNature: 'Nature',
    creationNatureSaisie: 'Compte de saisie (reçoit des écritures)',
    creationNatureRegroupement: 'Compte de regroupement (total, ne reçoit pas d’écriture)',
    creationNotes: 'Notes (facultatif)',
    creer: 'Créer le compte',
    creationEnCours: 'Création…',
    annuler: 'Annuler',
    creationEchec: 'La création a échoué. Réessayez.',

    // Fiche : modifier le libellé (partiel), changer le sens, désactiver — motif obligatoire
    // sur les deux derniers (acte sensible, tracé).
    retour: 'Retour au plan de comptes',
    modifier: 'Modifier le libellé',
    modifierNotes: 'Notes',
    enregistrer: 'Enregistrer',
    enregistrementEnCours: 'Enregistrement…',
    modificationEchec: 'La modification a échoué. Réessayez.',

    changerSens: 'Changer le sens',
    changerSensTitre: 'Changer le sens de ce compte ?',
    changerSensAide:
      'Le sens normal détermine la lecture du solde (débit ou crédit). Ce changement est tracé.',
    nouveauSens: 'Nouveau sens',
    motif: 'Motif (obligatoire)',
    motifPlaceholder: 'Pourquoi ce changement ?',
    motifRequis: 'Le motif est obligatoire (au moins 3 caractères).',
    confirmer: 'Confirmer',
    changementEnCours: 'Enregistrement…',
    changerSensEchec: 'Le changement de sens a échoué.',

    desactiver: 'Désactiver ce compte',
    desactiverTitre: 'Désactiver ce compte ?',
    desactiverAide:
      'Un compte désactivé sort des listes courantes et ne peut plus recevoir d’écritures. Refusé s’il porte déjà des écritures ou a des comptes enfants actifs.',
    desactiverConfirmer: 'Désactiver',
    desactivationEchec: 'La désactivation a échoué.',

    // Import / export CSV (Bloc 2) — aperçu en deux temps, rien n'est écrit avant confirmation.
    importExportTitre: 'Importer / exporter le plan',
    exporter: 'Exporter en CSV',
    exportEnCours: 'Export…',
    exportEchec: 'L’export a échoué. Réessayez.',

    importerFichier: 'Fichier CSV',
    importerApercu: 'Aperçu',
    apercuEnCours: 'Analyse du fichier…',
    apercuEchec: 'L’aperçu a échoué. Vérifiez le fichier.',
    aucunFichier: 'Choisissez un fichier CSV avant de lancer l’aperçu.',

    anomaliesTitre: (n: number) =>
      n <= 1 ? '1 anomalie — rien ne sera importé' : `${n} anomalies — rien ne sera importé`,

    apercuCreesTitre: (n: number) => (n <= 1 ? '1 compte à créer' : `${n} comptes à créer`),
    apercuModifiesTitre: (n: number) =>
      n <= 1 ? '1 compte à modifier' : `${n} comptes à modifier`,
    apercuInchanges: (n: number) => (n <= 1 ? '1 compte inchangé' : `${n} comptes inchangés`),
    apercuRienAFaire: 'Ce fichier ne change rien au plan actuel.',

    importerMotif: 'Motif (obligatoire)',
    importerMotifPlaceholder: 'Pourquoi cette correction ?',
    leverProvisoire:
      'Cette correction est la validation définitive de l’expert — lever le provisoire sur les comptes touchés.',
    confirmerImport: 'Confirmer l’import',
    confirmationEnCours: 'Import en cours…',
    confirmationEchec: 'L’import a échoué. Relancez l’aperçu.',
    importReussi: (crees: number, misAJour: number) =>
      `Import terminé : ${crees} compte(s) créé(s), ${misAJour} compte(s) modifié(s).`,
    recommencer: 'Recommencer',
  },

  grandLivre: {
    titre: 'Grand livre',
    sousTitre: 'Le détail des mouvements d’un compte, avec le solde cumulé.',

    choisirCompte: 'Compte',
    choisirComptePlaceholder: 'Choisissez un compte…',
    optionDesactive: (numero: string, nom: string) => `${numero} — ${nom} (désactivé)`,
    aucunCompteChoisi: 'Choisissez un compte pour voir son grand livre.',
    compteDesactive: 'Désactivé',
    compteDesactiveAide:
      'Ce compte est désactivé — vous consultez son historique, il ne reçoit plus d’écritures.',

    filtreDateDebut: 'Depuis le',
    filtreDateFin: 'Jusqu’au',
    reinitialiser: 'Réinitialiser',

    soldeOuverture: (montant: string, date: string) => `Solde au ${date} : ${montant}`,

    colonneDate: 'Date',
    colonnePiece: 'Pièce',
    colonneJournal: 'Journal',
    colonneLibelle: 'Libellé',
    colonneDebit: 'Débit',
    colonneCredit: 'Crédit',
    colonneSolde: 'Solde',

    total: (n: number) => (n <= 1 ? `${n} mouvement` : `${n} mouvements`),
    page: (courante: number, sur: number) => `Page ${courante} sur ${sur}`,
    precedent: 'Précédent',
    suivant: 'Suivant',

    chargementComptes: 'Chargement des comptes…',
    chargement: 'Chargement du grand livre…',
    vide: 'Aucun mouvement sur ce compte pour la période choisie.',
    interdit: 'Vous n’avez pas la permission de consulter les rapports comptables.',
    erreur: 'Impossible de charger le grand livre. Réessayez dans un instant.',
  },

  balance: {
    titre: 'Balance',
    sousTitre: 'Le récapitulatif de tous les comptes mouvementés sur la période.',

    filtreDateDebut: 'Depuis le',
    filtreDateFin: 'Jusqu’au',
    inclureSansMouvement: 'Inclure les comptes sans mouvement',
    reinitialiser: 'Réinitialiser',

    totalDebit: 'Total débit',
    totalCredit: 'Total crédit',
    equilibree: 'Balance équilibrée — Σ débit = Σ crédit.',
    desequilibree:
      'Balance DÉSÉQUILIBRÉE — Σ débit ≠ Σ crédit. Cela ne devrait jamais arriver : signalez-le immédiatement.',

    colonneCompte: 'Compte',
    colonneLibelle: 'Libellé',
    colonneSoldeOuverture: 'Solde ouverture',
    colonneDebit: 'Débit',
    colonneCredit: 'Crédit',
    colonneSoldeCloture: 'Solde clôture',

    chargement: 'Chargement de la balance…',
    vide: 'Aucun compte mouvementé sur la période choisie.',
    interdit: 'Vous n’avez pas la permission de consulter les rapports comptables.',
    erreur: 'Impossible de charger la balance. Réessayez dans un instant.',
  },

  rattachementsEpargne: {
    titre: 'Rattachements épargne',
    sousTitre: 'Le compte comptable rattaché à chaque produit d’épargne.',
    // Répété sur les 3 écrans du Bloc 5 : un rattachement ne change QUE les prochaines
    // opérations, jamais les écritures déjà passées (elles référencent un compte, pas ce
    // paramètre) — jamais laissé au silence.
    avertissement:
      'Ce changement s’applique aux prochaines opérations, jamais aux écritures déjà passées.',
    chargement: 'Chargement des rattachements…',
    listeVide: 'Aucun produit d’épargne actif.',
    interdit: 'Vous n’avez pas la permission de consulter ces rattachements.',
    erreur: 'Impossible de charger les rattachements. Réessayez dans un instant.',

    colonneProduit: 'Produit',
    colonneEpargne: 'Compte épargne (membre)',
    colonneEpargneClient: 'Compte épargne (client)',
    colonneInteret: 'Compte charge d’intérêts',
    aucun: '— non rattaché —',

    modifier: 'Modifier',
    annuler: 'Annuler',
    motif: 'Motif (obligatoire)',
    motifPlaceholder: 'Pourquoi ce changement ?',
    enregistrer: 'Enregistrer',
    enregistrementEnCours: 'Enregistrement…',
    echec: 'La modification a échoué. Réessayez.',
  },

  rattachementsCaisse: {
    titre: 'Caisse par agence',
    sousTitre: 'Le compte de caisse comptable rattaché à chaque agence.',
    avertissement:
      'Ce changement s’applique aux prochaines opérations, jamais aux écritures déjà passées.',
    chargement: 'Chargement des rattachements…',
    listeVide: 'Aucune agence active.',
    interdit: 'Vous n’avez pas la permission de consulter ces rattachements.',
    erreur: 'Impossible de charger les rattachements. Réessayez dans un instant.',

    colonneAgence: 'Agence',
    colonneCaisse: 'Compte de caisse',
    aucun: '— non rattaché —',

    modifier: 'Modifier',
    annuler: 'Annuler',
    motif: 'Motif (obligatoire)',
    motifPlaceholder: 'Pourquoi ce changement ?',
    enregistrer: 'Enregistrer',
    enregistrementEnCours: 'Enregistrement…',
    echec: 'La modification a échoué. Réessayez.',
  },

  parametresParts: {
    titre: 'Paramètres des parts sociales',
    sousTitre: 'Valeurs d’institution — valeur d’une part, minimum d’adhésion, rattachements.',
    avertissement:
      'Ce changement s’applique aux prochaines opérations, jamais aux écritures déjà passées.',
    chargement: 'Chargement des paramètres…',
    interdit: 'Vous n’avez pas la permission de consulter ces paramètres.',
    erreur: 'Impossible de charger les paramètres. Réessayez dans un instant.',
    nonParametre: 'Les parts sociales ne sont pas encore paramétrées.',
    provisoire: 'provisoire',
    provisoireAide: 'Valeurs non encore validées par l’expert-comptable SFD.',

    valeurPart: 'Valeur d’une part (francs CFA)',
    minimumParts: 'Minimum de parts pour adhérer',
    remboursable: 'Les parts sont remboursables',
    momentAdhesion: 'Moment de l’adhésion',
    momentSouscription: 'À la souscription',
    momentLiberation: 'À la libération',
    compteLiberees: 'Compte des parts libérées',
    compteNonLiberees: 'Compte des parts non libérées',
    aucun: '— non rattaché —',

    modifier: 'Modifier',
    annuler: 'Annuler',
    motif: 'Motif (obligatoire)',
    motifPlaceholder: 'Pourquoi ce changement ?',
    enregistrer: 'Enregistrer',
    enregistrementEnCours: 'Enregistrement…',
    echec: 'La modification a échoué. Réessayez.',
  },

  tiersKyc: {
    titre: 'Connaissance client (KYC) et risque LBC/FT',
    intro: 'Ces informations alimentent le calcul du niveau de risque et conditionnent l’activation.',
    reservePP: 'Le KYC détaillé ne concerne que les personnes physiques pour l’instant.',

    origineFonds: 'Origine des fonds',
    origineFondsPlaceholder: 'Ex. : salaire, activité commerciale, transfert…',
    secteur: 'Secteur d’activité',
    secteurChoisir: 'Choisir un secteur…',
    secteursIndisponibles: 'Impossible de charger les secteurs.',
    modeEntree: 'Mode d’entrée en relation',
    modeChoisir: 'Choisir…',
    modes: {
      presentiel: 'Présentiel (au guichet)',
      tiers_confiance: 'Introduction par un tiers de confiance',
      distance: 'À distance',
    } as Record<string, string>,
    ppe: 'Personne politiquement exposée (PPE)',
    ppeAide: 'Le client exerce, ou est proche de quelqu’un qui exerce, une fonction publique importante.',
    ppeRelation: 'Lien',
    ppeRelations: { direct: 'La personne elle-même', entourage: 'Un proche' } as Record<string, string>,
    ppeFonction: 'Fonction (facultatif)',
    ppeFonctionPlaceholder: 'Ex. : maire, député, haut fonctionnaire…',

    enregistrer: 'Enregistrer et recalculer le risque',
    enCours: 'Enregistrement…',
    erreur: 'L’enregistrement a échoué. Réessayez.',

    // Niveau de risque + provisoire
    niveauTitre: 'Niveau de risque',
    niveaux: { faible: 'Faible', moyen: 'Moyen', eleve: 'Élevé' } as Record<string, string>,
    nonEvalue: 'Non encore évalué — renseignez les données KYC.',
    provisoire:
      'Barème PROVISOIRE, non validé par le responsable LBC/FT : ce niveau n’est pas une valeur réglementaire confirmée.',
  },

  tiersCoordonnees: {
    chargement: 'Chargement des coordonnées…',
    erreur: 'Impossible de charger les coordonnées.',
    vide: 'Aucune coordonnée enregistrée.',

    // Groupes
    telephones: 'Téléphones',
    emails: 'Adresses e-mail',
    adresses: 'Adresses',

    principal: 'Principal',
    definirPrincipal: 'Définir comme principal',
    supprimer: 'Supprimer',
    forceLabel: 'Numéro non vérifié',

    // Ajout
    ajouterTelephone: 'Ajouter un téléphone',
    ajouterEmail: 'Ajouter un e-mail',
    ajouterAdresse: 'Ajouter une adresse',
    ajouter: 'Ajouter',
    annuler: 'Annuler',
    enCours: 'Enregistrement…',
    marquerPrincipal: 'En faire la coordonnée principale',

    // Téléphone
    numero: 'Numéro de téléphone',
    numeroPlaceholder: 'Ex. : 90 12 34 56',
    // Échappatoire : n'apparaît QU'APRÈS un refus forçable. Jamais un réflexe.
    forcerTitre: 'Ce numéro n’a pas été reconnu',
    forcerAide:
      'Vérifiez d’abord la saisie. Si le numéro est réellement correct (format inhabituel, ligne récente), vous pouvez l’enregistrer tel quel — il sera signalé comme non vérifié.',
    forcerConfirmer: 'Enregistrer quand même',

    // E-mail
    email: 'Adresse e-mail',
    emailPlaceholder: 'nom@exemple.com',

    // Adresse — les DEUX modes sont d'égale importance (le repère est le cas courant en rural).
    adresseIntro: 'Renseignez une adresse formelle OU un point de repère — l’un suffit.',
    rue: 'Rue / voie',
    ruePlaceholder: 'Ex. : Rue KK-12, porte 45',
    quartier: 'Quartier',
    repere: 'Point de repère',
    reperePlaceholder: 'Ex. : derrière la mosquée, près du puits',
    adresseVide: 'Renseignez au moins une rue ou un point de repère.',

    // Suppression
    supprimerTitre: 'Supprimer cette coordonnée ?',
    motif: 'Motif (facultatif)',
    motifPlaceholder: 'Ex. : numéro erroné signalé par le client',
    confirmerSuppression: 'Supprimer',

    sousTypes: {
      mobile: 'Mobile',
      landline: 'Fixe',
      professional: 'Professionnel',
      emergency: 'Urgence',
      spouse: 'Conjoint',
      home: 'Domicile',
      work: 'Travail',
      postal: 'Postale',
      permanent: 'Permanente',
      temporary: 'Temporaire',
      personal: 'Personnel',
      other: 'Autre',
    } as Record<string, string>,

    erreurGenerique: 'L’opération a échoué. Réessayez dans un instant.',
  },

  tiersPieces: {
    chargement: 'Chargement des pièces…',
    erreur: 'Impossible de charger les pièces.',
    vide: 'Aucune pièce enregistrée.',

    ajouter: 'Ajouter une pièce',
    ajouterBouton: 'Ajouter',
    annuler: 'Annuler',
    enCours: 'Enregistrement…',

    // Formulaire
    type: 'Type de pièce',
    typeChoisir: 'Choisir…',
    typesIndisponibles: 'Impossible de charger les types de pièces.',
    numero: 'Numéro',
    numeroPlaceholder: 'Tel qu’il figure sur la pièce',
    autorite: 'Autorité de délivrance (facultatif)',
    dateEmission: 'Date de délivrance (facultatif)',
    dateExpiration: 'Date d’expiration',
    dateExpirationFacultative: 'Date d’expiration (facultatif)',
    paysEmission: 'Pays de délivrance (facultatif)',
    paysChoisir: 'Choisir…',
    marquerPrincipale: 'En faire la pièce principale',

    principale: 'Principale',
    definirPrincipale: 'Définir comme principale',
    verifier: 'Vérifier',
    verifiee: 'Vérifiée',
    supprimer: 'Supprimer',

    // Badges de validité — visibles d'un coup d'œil. Une pièce périmée ne bloque pas, mais se voit.
    validite: {
      valide: 'Valide',
      expire_bientot: 'Expire bientôt',
      perimee: 'Périmée',
      sans_objet: 'Sans échéance',
    } as Record<string, string>,

    // Doublon : message actionnable quand la fiche est nommée.
    doublonLien: 'Voir la fiche',

    // Vérification
    verifierTitre: 'Vérifier cette pièce ?',
    verifierAide:
      'Vous attestez avoir vu la pièce en original et l’avoir jugée conforme. Une pièce modifiée ensuite perdra cette vérification.',
    verifierNote: 'Note de vérification (facultatif)',
    verifierConfirmer: 'Confirmer la vérification',

    // Suppression
    supprimerTitre: 'Supprimer cette pièce ?',
    motif: 'Motif (facultatif)',
    motifPlaceholder: 'Ex. : doublon d’une autre pièce',
    confirmerSuppression: 'Supprimer',

    erreurGenerique: 'L’opération a échoué. Réessayez dans un instant.',
  },

  session: {
    expiree: 'Votre session a expiré. Veuillez vous reconnecter.',
    deconnexion: 'Se déconnecter',
  },

  chargement: 'Chargement…',
} as const
