import { z } from 'zod'

import { LIBELLES } from '@/libelles/fr'

const M = LIBELLES.modification

/**
 * Modification d'une fiche — MIROIR de ModifierUtilisateurRequest côté backend.
 *
 * Seuls nom, prénom, adresse et téléphone. matricule et identifiant en sont ABSENTS : ce
 * sont les clés par lesquelles l'audit désigne une personne, les changer rendrait
 * l'historique illisible. La décision est côté serveur (il les ignore) ; on l'applique aussi
 * ici pour que le formulaire ne propose même pas de les toucher.
 */
const MOTIF_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export const schemaModification = z.object({
  last_name: z.string().trim().min(1, M.nomRequis).max(100),
  first_name: z.string().trim().min(1, M.prenomRequis).max(100),
  email: z.string().trim().min(1, M.emailRequis).max(255).regex(MOTIF_EMAIL, M.emailInvalide),
  phone: z.string().trim().max(30).optional(),
})

export type ChampsModification = z.infer<typeof schemaModification>
