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

  session: {
    expiree: 'Votre session a expiré. Veuillez vous reconnecter.',
    deconnexion: 'Se déconnecter',
  },

  accueil: {
    titre: 'Espace de travail',
    bienvenue: 'Vous êtes connecté.',
    // Écran d'attente volontairement minimal : il sert à PROUVER que la route protégée
    // fonctionne, pas à préfigurer le tableau de bord.
    provisoire: 'Les écrans de travail seront ajoutés au fil des prochains modules.',
  },

  chargement: 'Chargement…',
} as const
