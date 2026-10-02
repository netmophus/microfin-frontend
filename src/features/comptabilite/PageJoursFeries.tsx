import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarOff } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  type JourFerie,
  ajouterJourFerie,
  listerJoursFeries,
  messageRefusCompte,
  supprimerJourFerie,
} from '@/features/comptabilite/api'
import { LIBELLES } from '@/libelles/fr'

const J = LIBELLES.joursFeries

function fmt(gabarit: string, valeurs: Record<string, string>): string {
  return gabarit.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '')
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR')
}

function anneeActuelle(): number {
  return new Date().getFullYear()
}

/**
 * Calendrier des jours fériés (chantier P1bis, lot 4a) — fondation ADDITIVE SEULE : les fériés
 * sont saisis PAR DATE précise (les fêtes musulmanes suivent le calendrier lunaire, jamais la
 * même date d'une année sur l'autre), année par année. Le report effectif d'une échéance tombée
 * un jour férié est un lot séparé (4b), pas encore fait — cet écran ne fait QUE paramétrer le
 * calendrier.
 */
export function PageJoursFeries() {
  const client = useQueryClient()
  const [annee, setAnnee] = useState(anneeActuelle)
  const [dateFeriee, setDateFeriee] = useState('')
  const [libelle, setLibelle] = useState('')
  const [aSupprimer, setASupprimer] = useState<JourFerie | null>(null)

  const cleListe = ['comptabilite', 'jours-feries', annee]
  const requete = useQuery({ queryKey: cleListe, queryFn: () => listerJoursFeries(annee) })

  const ajout = useMutation({
    mutationFn: () => ajouterJourFerie(dateFeriee, libelle.trim()),
    onSuccess: () => {
      setDateFeriee('')
      setLibelle('')
      void client.invalidateQueries({ queryKey: cleListe })
    },
  })

  const suppression = useMutation({
    mutationFn: (id: string) => supprimerJourFerie(id),
    onSuccess: () => {
      setASupprimer(null)
      void client.invalidateQueries({ queryKey: cleListe })
    },
  })

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <CalendarOff className="size-5 text-muted-foreground" />
          {J.titre}
        </h1>
        <p className="text-sm text-muted-foreground">{J.sousTitre}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/20 p-3">
        <div className="space-y-1">
          <Label htmlFor="jf-annee">{J.champAnnee}</Label>
          <Input
            id="jf-annee"
            type="number"
            value={annee}
            onChange={(e) => setAnnee(Number(e.target.value) || anneeActuelle())}
            className="w-28"
          />
        </div>
      </div>

      <div className="space-y-3 rounded-md border p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {J.ajoutTitre}
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="jf-date">{J.champDate}</Label>
            <Input
              id="jf-date"
              type="date"
              value={dateFeriee}
              onChange={(e) => setDateFeriee(e.target.value)}
              className="w-auto"
            />
          </div>
          <div className="min-w-48 flex-1 space-y-1">
            <Label htmlFor="jf-libelle">{J.champLibelle}</Label>
            <Input
              id="jf-libelle"
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              placeholder={J.libellePlaceholder}
            />
          </div>
          <Button
            onClick={() => ajout.mutate()}
            disabled={ajout.isPending || dateFeriee === '' || libelle.trim() === ''}
          >
            {ajout.isPending ? J.ajoutEnCours : J.ajouterBouton}
          </Button>
        </div>
        {ajout.isError && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{messageRefusCompte(ajout.error, J.ajoutEchec)}</AlertDescription>
          </Alert>
        )}
      </div>

      {requete.isPending ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{J.chargement}</p>
      ) : requete.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription className="space-y-2">
            <p>{J.erreur}</p>
            <Button size="sm" variant="outline" onClick={() => void requete.refetch()}>
              {J.reessayer}
            </Button>
          </AlertDescription>
        </Alert>
      ) : requete.data.length === 0 ? (
        <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
          {J.listeVide}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{J.colDate}</th>
                <th className="px-3 py-2 text-left font-medium">{J.colLibelle}</th>
                <th className="px-3 py-2" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {requete.data.map((jf) => (
                <tr key={jf.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{formatDate(jf.date_feriee)}</td>
                  <td className="px-3 py-2">{jf.libelle}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => setASupprimer(jf)}>
                      {J.supprimerBouton}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {aSupprimer && (
        <div className="space-y-3 rounded-md border border-warning/50 bg-warning-subtle/40 p-4">
          <p className="text-sm font-medium">
            {fmt(J.confirmerSuppression, {
              libelle: aSupprimer.libelle,
              date: formatDate(aSupprimer.date_feriee),
            })}
          </p>
          {suppression.isError && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>
                {messageRefusCompte(suppression.error, J.suppressionEchec)}
              </AlertDescription>
            </Alert>
          )}
          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={() => suppression.mutate(aSupprimer.id)}
              disabled={suppression.isPending}
            >
              {suppression.isPending ? J.suppressionEnCours : J.confirmerSuppressionBouton}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setASupprimer(null)}
              disabled={suppression.isPending}
            >
              {J.annuler}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
