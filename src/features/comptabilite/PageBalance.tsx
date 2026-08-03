import { useQuery } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { Scale } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { chargerBalance, type LigneBalance } from '@/features/comptabilite/api'
import { formatFcfa } from '@/features/epargne/api'
import { LIBELLES } from '@/libelles/fr'

const B = LIBELLES.balance

/**
 * Balance — Σdébit/Σcrédit de tous les comptes mouvementés sur la période. Réservé à
 * compta.rapport.read. Le bandeau d'équilibre reprend le MÊME langage visuel que le
 * rapprochement épargne (vert/rouge, role status/alert) : l'invariant de la partie double
 * garantit qu'il est presque toujours vert, mais c'est cette familiarité qui le rend
 * rassurant d'un coup d'œil — un écart serait le signe d'une anomalie grave.
 */
export function PageBalance() {
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [inclureSansMouvement, setInclureSansMouvement] = useState(false)

  const requete = useQuery({
    queryKey: ['comptabilite', 'balance', dateDebut, dateFin, inclureSansMouvement],
    queryFn: () => chargerBalance({ dateDebut, dateFin, inclureSansMouvement }),
  })

  const reinitialiser = () => {
    setDateDebut('')
    setDateFin('')
    setInclureSansMouvement(false)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Scale className="size-5 text-muted-foreground" />
          {B.titre}
        </h1>
        <p className="text-sm text-muted-foreground">{B.sousTitre}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/20 p-3">
        <div className="space-y-1">
          <Label htmlFor="bal-debut">{B.filtreDateDebut}</Label>
          <Input
            id="bal-debut"
            type="date"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            className="w-auto"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="bal-fin">{B.filtreDateFin}</Label>
          <Input
            id="bal-fin"
            type="date"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            className="w-auto"
          />
        </div>
        <label className="flex items-center gap-1.5 pb-1.5 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={inclureSansMouvement}
            onChange={(e) => setInclureSansMouvement(e.target.checked)}
          />
          {B.inclureSansMouvement}
        </label>
        {(dateDebut || dateFin || inclureSansMouvement) && (
          <Button type="button" variant="ghost" size="sm" onClick={reinitialiser}>
            {B.reinitialiser}
          </Button>
        )}
      </div>

      {requete.isPending ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{B.chargement}</p>
      ) : requete.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {requete.error instanceof AxiosError && requete.error.response?.status === 403
              ? B.interdit
              : B.erreur}
          </AlertDescription>
        </Alert>
      ) : (
        <Contenu donnees={requete.data} />
      )}
    </div>
  )
}

function Contenu({ donnees }: { donnees: Awaited<ReturnType<typeof chargerBalance>> }) {
  return (
    <div className="space-y-4">
      {donnees.equilibree ? (
        <div
          role="status"
          className="rounded-md border border-success/50 bg-success-subtle/40 px-3 py-2 text-sm text-foreground"
        >
          {B.equilibree}
        </div>
      ) : (
        <div
          role="alert"
          className="rounded-md border border-danger/50 bg-danger-subtle/40 px-3 py-2 text-sm text-foreground"
        >
          {B.desequilibree}
        </div>
      )}

      <div className="flex flex-wrap gap-6 text-sm">
        <div>
          <span className="text-muted-foreground">{B.totalDebit} : </span>
          <span className="font-medium tabular-nums">{formatFcfa(donnees.total_debit)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">{B.totalCredit} : </span>
          <span className="font-medium tabular-nums">{formatFcfa(donnees.total_credit)}</span>
        </div>
      </div>

      {donnees.lignes.length === 0 ? (
        <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
          {B.vide}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{B.colonneCompte}</th>
                <th className="px-3 py-2 text-left font-medium">{B.colonneLibelle}</th>
                <th className="px-3 py-2 text-right font-medium">{B.colonneSoldeOuverture}</th>
                <th className="px-3 py-2 text-right font-medium">{B.colonneDebit}</th>
                <th className="px-3 py-2 text-right font-medium">{B.colonneCredit}</th>
                <th className="px-3 py-2 text-right font-medium">{B.colonneSoldeCloture}</th>
              </tr>
            </thead>
            <tbody>
              {donnees.lignes.map((ligne) => (
                <LigneCompteBalance key={ligne.account_number} ligne={ligne} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function LigneCompteBalance({ ligne }: { ligne: LigneBalance }) {
  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-2 font-mono text-xs">{ligne.account_number}</td>
      <td className="px-3 py-2">{ligne.name}</td>
      <td className="px-3 py-2 text-right tabular-nums">{formatFcfa(ligne.solde_ouverture)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{formatFcfa(ligne.total_debit)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{formatFcfa(ligne.total_credit)}</td>
      <td className="px-3 py-2 text-right font-medium tabular-nums">
        {formatFcfa(ligne.solde_cloture)}
      </td>
    </tr>
  )
}
