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
    sansAgence: '—',

    rechercher: 'Rechercher — numéro ou nom',
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

    // Le statut prospect, expliqué — on montre l'état réel et pourquoi il n'est pas actif.
    prospectTitre: 'Fiche en attente de validation KYC',
    prospectExplication:
      'Cette fiche n’est pas encore active. L’activation viendra avec la validation KYC (module à venir). Aucune opération n’est encore possible sur ce tiers.',

    // Vue limitée (read.basic) : ce que voit un caissier, sans détail ni frise.
    vueLimitee: 'Vue limitée',
    vueLimiteeAide:
      'Vous voyez l’identification de ce tiers. Le détail complet est réservé aux profils habilités.',

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

    // Activation refusée : on affiche TOUTES les conditions manquantes (conception T1e/T3),
    // pas un message générique.
    activationTitre: 'Activation impossible pour l’instant',
    activationIntro: 'L’activation requiert que toutes ces conditions soient remplies :',
    activationEnCours: 'Vérification des conditions…',

    erreur: 'L’action a échoué. Réessayez dans un instant.',
    interdit: 'Vous n’avez pas la permission d’effectuer cette action.',
  },

  session: {
    expiree: 'Votre session a expiré. Veuillez vous reconnecter.',
    deconnexion: 'Se déconnecter',
  },

  chargement: 'Chargement…',
} as const
