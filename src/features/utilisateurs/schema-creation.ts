import { z } from 'zod'

import { LIBELLES } from '@/libelles/fr'

const C = LIBELLES.creation

/**
 * Validation du formulaire de création — MIROIR des contraintes de CreerUtilisateurRequest
 * côté backend (schemas.py). Un formulaire qui accepte ce que le serveur refuse renvoie
 * l'utilisateur à un aller-retour inutile ; l'inverse (plus strict que le serveur) refuse à
 * tort des données valides. On colle donc aux mêmes bornes.
 *
 * L'email suit le même motif SOMMAIRE que le backend (« quelque chose @ quelque chose .
 * quelque chose ») — volontairement pas de validation RFC stricte, qui rejette des adresses
 * valides. Voir le commentaire de MOTIF_EMAIL côté serveur.
 *
 * L'agence est OBLIGATOIRE dans le formulaire, alors que le backend l'accepte nulle : c'est
 * la règle métier retenue (option 2). Une IMF a toujours au moins une agence, et un compte
 * sans rattachement serait invisible de quiconque n'a pas la portée réseau. On impose donc
 * le choix ici, à la saisie, plutôt que de laisser créer un compte orphelin.
 */
const MOTIF_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export const schemaCreation = z.object({
  matricule: z
    .string()
    .trim()
    .min(1, C.matriculeRequis)
    .max(30, C.matriculeLong),
  last_name: z.string().trim().min(1, C.nomRequis).max(100),
  first_name: z.string().trim().min(1, C.prenomRequis).max(100),
  username: z
    .string()
    .trim()
    .min(3, C.identifiantCourt)
    .max(50, C.identifiantLong),
  email: z
    .string()
    .trim()
    .min(1, C.emailRequis)
    .max(255)
    .regex(MOTIF_EMAIL, C.emailInvalide),
  // Téléphone facultatif : chaîne vide admise, transformée en null à l'envoi.
  phone: z.string().trim().max(30).optional(),
  primary_agency_id: z.string().min(1, C.agenceRequise),
})

export type ChampsCreation = z.infer<typeof schemaCreation>
