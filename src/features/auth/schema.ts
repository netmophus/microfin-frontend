import { z } from 'zod'

import { LIBELLES } from '@/libelles/fr'

/**
 * Validation du formulaire de connexion.
 *
 * VOLONTAIREMENT MINIMALE : présence, rien d'autre.
 *
 * Aucune règle de longueur ni de complexité sur le mot de passe à la CONNEXION. Ces règles
 * appartiennent à la création et au changement de mot de passe. Les appliquer ici
 * refuserait localement des identifiants pourtant valides — un compte créé avant un
 * durcissement de la politique, par exemple — et l'utilisateur verrait son propre mot de
 * passe rejeté sans comprendre par qui.
 *
 * On ne devine pas non plus si la saisie est un identifiant ou une adresse : le backend
 * accepte les deux et cherche sur les deux colonnes. Trancher côté front reviendrait à
 * refuser une saisie que le serveur aurait acceptée.
 */
export const schemaConnexion = z.object({
  identifiant: z.string().trim().min(1, LIBELLES.connexion.identifiantRequis),
  motDePasse: z.string().min(1, LIBELLES.connexion.motDePasseRequis),
})

export type ChampsConnexion = z.infer<typeof schemaConnexion>
