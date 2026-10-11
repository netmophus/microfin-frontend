import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { BadgeRisque, BadgeStatut } from '@/features/tiers/badges'
import { listerPersonnesLiees } from '@/features/tiers/personnesLiees'
import { LIBELLES } from '@/libelles/fr'

const L = LIBELLES.tiersLiees

/** Onglet « KYC / Risque » d'une société ou d'un groupement : le niveau est HÉRITÉ des personnes
 *  liées en cours (règle provisoire). On montre le niveau, son origine en clair, et l'état de
 *  chaque personne liée — c'est là que se lit pourquoi la fiche est « élevée ». */
export function OngletRisquePm({ tierId }: { tierId: string }) {
  const requete = useQuery({
    queryKey: ['tiers', 'personnes-liees', tierId],
    queryFn: () => listerPersonnesLiees(tierId),
  })

  if (requete.isPending) {
    return <p className="py-4 text-sm text-muted-foreground">{L.chargement}</p>
  }
  if (requete.isError) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription className="space-y-2">
          <p>{L.erreur}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => void requete.refetch()}>
            {L.reessayer}
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const { risque } = requete.data
  const enCours = requete.data.items.filter((i) => i.en_cours)
  const sansNiveau = enCours.filter((i) => i.niveau_risque === null)

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">{L.risqueTitre}</h3>
        <p className="text-sm text-muted-foreground">{L.risqueIntro}</p>
      </div>

      {risque.niveau === null ? (
        <div className="rounded-md border border-dashed p-4 text-sm">
          <p className="font-medium">{L.risqueNonEvalue}</p>
          <p className="mt-1 text-muted-foreground">{L.risqueAjouter}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{L.risqueNiveau} :</span>
            <BadgeRisque niveau={risque.niveau} />
          </div>
          {/* L'origine est une phrase construite par le serveur : « Élevé — hérité de … ». */}
          <p className="text-sm">
            <span className="text-muted-foreground">{L.risqueOrigine} : </span>
            {risque.explication}
          </p>
          {risque.provisoire && (
            <Alert role="alert" className="border-warning/40 bg-warning-subtle">
              <AlertDescription className="text-warning">{L.risqueProvisoire}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* État partiel : le niveau est calculé sur ce qui est connu, on dit ce qui manque. */}
      {risque.niveau !== null && sansNiveau.length > 0 && (
        <Alert>
          <AlertDescription>
            {sansNiveau.length === 1
              ? `1 personne liée n’a pas de niveau de risque calculé : ${sansNiveau.map((i) => i.nom).join(', ')}.`
              : `${sansNiveau.length} personnes liées n’ont pas de niveau de risque calculé.`}
          </AlertDescription>
        </Alert>
      )}

      {enCours.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">{L.risquePersonnes}</h3>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {L.colNom}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {L.colRole}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {L.colStatut}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {L.colRisque}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {enCours.map((lien) => (
                  <tr key={lien.id}>
                    <td className="px-3 py-2">
                      <Link
                        to={`/tiers/${lien.individual_tier_id}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {lien.nom}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{L.roles[lien.role] ?? lien.role}</td>
                    <td className="px-3 py-2">
                      <BadgeStatut code={lien.statut} />
                    </td>
                    <td className="px-3 py-2">
                      {lien.niveau_risque ? (
                        <BadgeRisque niveau={lien.niveau_risque} />
                      ) : (
                        <span className="text-muted-foreground">{L.risqueNonEvaluee}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
