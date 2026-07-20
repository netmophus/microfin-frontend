import { z } from 'zod'

import { estConforme } from '@/features/auth/politique'
import { LIBELLES } from '@/libelles/fr'

/**
 * Validation du formulaire de changement de mot de passe.
 *
 * Trois contrôles côté client, chacun pour éviter un aller-retour serveur inutile :
 *
 *   - présence des trois champs ;
 *   - le nouveau respecte la politique (miroir du backend, cf. politique.ts) ;
 *   - la confirmation correspond au nouveau — ce contrôle N'EXISTE QUE côté client. Le
 *     backend ne reçoit qu'un seul mot de passe : la confirmation est une garde contre la
 *     faute de frappe, pas une donnée métier. Un utilisateur qui se trompe deux fois de la
 *     même façon reste protégé par l'obligation de renouvellement à la première connexion.
 *
 * Aucun contrôle sur l'ANCIEN mot de passe au-delà de sa présence : sa validité est une
 * affaire entre le serveur et le hash stocké, que le front ne connaît pas.
 */
export const schemaMotDePasse = z
  .object({
    actuel: z.string().min(1, LIBELLES.motDePasse.actuelRequis),
    nouveau: z
      .string()
      .min(1, LIBELLES.motDePasse.nouveauRequis)
      .refine(estConforme, LIBELLES.motDePasse.nonConforme),
    confirmation: z.string().min(1, LIBELLES.motDePasse.confirmationRequise),
  })
  .refine((champs) => champs.nouveau === champs.confirmation, {
    message: LIBELLES.motDePasse.confirmationDifferente,
    // Rattaché au champ de confirmation : c'est là que l'erreur doit s'afficher, sous le
    // champ que l'utilisateur vient de remplir.
    path: ['confirmation'],
  })

export type ChampsMotDePasse = z.infer<typeof schemaMotDePasse>
