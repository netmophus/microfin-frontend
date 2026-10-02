import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  type JourneeComptable,
  cloturerJournee,
  chargerJourneeCourante,
  listerJournees,
  messageRefusCompte,
  ouvrirJournee,
} from '@/features/comptabilite/api'
import { LIBELLES } from '@/libelles/fr'

const J = LIBELLES.journeeComptable

const CLE_COURANTE = ['comptabilite', 'journee', 'courante']
const CLE_HISTORIQUE = ['comptabilite', 'journee', 'historique']

function fmt(gabarit: string, valeurs: Record<string, string>): string {
  return gabarit.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '')
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR')
}

function formatHorodatage(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR')
}

/**
 * Journée comptable (chantier P1bis, lot 1) — fondation ADDITIVE SEULE : au plus une journée
 * ouverte à la fois (réseau entier, pas par agence), date comptable distincte de la date
 * système. Rien d'autre n'est encore branché dessus (ni la caisse, ni la datation des
 * opérations) — ces lots viendront après.
 */
export function PageJourneeComptable() {
  const client = useQueryClient()
  const [ouvertureVisible, setOuvertureVisible] = useState(false)
  const [dateSaisie, setDateSaisie] = useState('')
  const [confirmationCloture, setConfirmationCloture] = useState(false)

  const couranteRequete = useQuery({ queryKey: CLE_COURANTE, queryFn: chargerJourneeCourante })
  const historiqueRequete = useQuery({ queryKey: CLE_HISTORIQUE, queryFn: listerJournees })

  const ouverture = useMutation({
    mutationFn: (date: string) => ouvrirJournee(date),
    onSuccess: () => {
      setOuvertureVisible(false)
      void client.invalidateQueries({ queryKey: CLE_COURANTE })
      void client.invalidateQueries({ queryKey: CLE_HISTORIQUE })
    },
  })

  const cloture = useMutation({
    mutationFn: cloturerJournee,
    onSuccess: () => {
      setConfirmationCloture(false)
      void client.invalidateQueries({ queryKey: CLE_COURANTE })
      void client.invalidateQueries({ queryKey: CLE_HISTORIQUE })
    },
  })

  function ouvrirLeFormulaire(dateProposee: string) {
    setDateSaisie(dateProposee)
    setOuvertureVisible(true)
    ouverture.reset()
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <CalendarCheck className="size-5 text-muted-foreground" />
          {J.titre}
        </h1>
        <p className="text-sm text-muted-foreground">{J.sousTitre}</p>
      </div>

      {couranteRequete.isPending ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{J.chargement}</p>
      ) : couranteRequete.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription className="space-y-2">
            <p>{J.erreur}</p>
            <Button size="sm" variant="outline" onClick={() => void couranteRequete.refetch()}>
              {J.reessayer}
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <section className="space-y-3 rounded-md border p-4">
          {couranteRequete.data.journee === null ? (
            <>
              <p className="text-sm text-muted-foreground">{J.aucuneOuverte}</p>
              {!ouvertureVisible && (
                <Button
                  onClick={() => ouvrirLeFormulaire(couranteRequete.data.prochaine_date_proposee)}
                >
                  {J.ouvrirBouton}
                </Button>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge ton="success">{J.statutOuverte}</Badge>
                <p className="text-sm">
                  {fmt(J.journeeOuverteDepuis, {
                    date: formatDate(couranteRequete.data.journee.date_comptable),
                    acteur: couranteRequete.data.journee.opened_par_nom ?? J.acteurInconnu,
                    horodatage: formatHorodatage(couranteRequete.data.journee.opened_at),
                  })}
                </p>
              </div>
              {!confirmationCloture && (
                <Button variant="outline" onClick={() => setConfirmationCloture(true)}>
                  {J.cloturerBouton}
                </Button>
              )}
            </>
          )}

          {ouvertureVisible && couranteRequete.data.journee === null && (
            <div className="space-y-3 rounded-md border border-dashed p-3">
              <div className="space-y-1">
                <Label htmlFor="journee-date">{J.champDate}</Label>
                <Input
                  id="journee-date"
                  type="date"
                  value={dateSaisie}
                  onChange={(e) => setDateSaisie(e.target.value)}
                  className="w-auto"
                />
                <p className="text-xs text-muted-foreground">
                  {fmt(J.dateProposeeNote, {
                    date: formatDate(couranteRequete.data.prochaine_date_proposee),
                  })}
                </p>
              </div>
              {ouverture.isError && (
                <Alert variant="destructive" role="alert">
                  <AlertDescription>
                    {messageRefusCompte(ouverture.error, J.echec)}
                  </AlertDescription>
                </Alert>
              )}
              <div className="flex gap-2">
                <Button
                  onClick={() => ouverture.mutate(dateSaisie)}
                  disabled={ouverture.isPending || dateSaisie === ''}
                >
                  {ouverture.isPending ? J.ouvertureEnCours : J.confirmerOuvertureBouton}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setOuvertureVisible(false)}
                  disabled={ouverture.isPending}
                >
                  {J.annuler}
                </Button>
              </div>
            </div>
          )}

          {confirmationCloture && couranteRequete.data.journee !== null && (
            <div className="space-y-3 rounded-md border border-warning/50 bg-warning-subtle/40 p-3">
              <p className="text-sm font-medium">
                {fmt(J.confirmerCloture, {
                  date: formatDate(couranteRequete.data.journee.date_comptable),
                })}
              </p>
              {cloture.isError && (
                <Alert variant="destructive" role="alert">
                  <AlertDescription>{messageRefusCompte(cloture.error, J.echec)}</AlertDescription>
                </Alert>
              )}
              <div className="flex gap-2">
                <Button onClick={() => cloture.mutate()} disabled={cloture.isPending}>
                  {cloture.isPending ? J.clotureEnCours : J.confirmerClotureBouton}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setConfirmationCloture(false)}
                  disabled={cloture.isPending}
                >
                  {J.annuler}
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {J.historiqueTitre}
        </h2>
        {historiqueRequete.isPending ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{J.chargement}</p>
        ) : historiqueRequete.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription className="space-y-2">
              <p>{J.erreur}</p>
              <Button size="sm" variant="outline" onClick={() => void historiqueRequete.refetch()}>
                {J.reessayer}
              </Button>
            </AlertDescription>
          </Alert>
        ) : historiqueRequete.data.length === 0 ? (
          <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            {J.historiqueVide}
          </p>
        ) : (
          <TableauHistorique journees={historiqueRequete.data} />
        )}
      </div>
    </div>
  )
}

function TableauHistorique({ journees }: { journees: JourneeComptable[] }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-3 py-2 text-left font-medium">{J.colDate}</th>
            <th className="px-3 py-2 text-left font-medium">{J.colStatut}</th>
            <th className="px-3 py-2 text-left font-medium">{J.colOuvertePar}</th>
            <th className="px-3 py-2 text-left font-medium">{J.colClotureePar}</th>
          </tr>
        </thead>
        <tbody>
          {journees.map((j) => (
            <tr key={j.id} className="border-b last:border-0">
              <td className="px-3 py-2 font-mono text-xs">{formatDate(j.date_comptable)}</td>
              <td className="px-3 py-2">
                <Badge ton={j.status === 'ouverte' ? 'success' : 'neutral'}>
                  {j.status === 'ouverte' ? J.statutOuverte : J.statutCloturee}
                </Badge>
              </td>
              <td className="px-3 py-2">{j.opened_par_nom ?? J.sansValeur}</td>
              <td className="px-3 py-2">{j.closed_par_nom ?? J.sansValeur}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
