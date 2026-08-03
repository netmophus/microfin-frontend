import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  chargerGrandLivre,
  listerComptesSelecteurRapport,
  type LigneGrandLivre,
} from '@/features/comptabilite/api'
import { formatFcfa } from '@/features/epargne/api'
import { LIBELLES } from '@/libelles/fr'

const G = LIBELLES.grandLivre

/**
 * Grand livre — mouvements VALIDÉS d'UN compte, triés chronologiquement, avec solde cumulé.
 * Réservé à compta.rapport.read (route protégée). Le sélecteur de compte inclut les comptes
 * désactivés (leur historique reste consultable) — signalé dans le menu déroulant ET dans
 * l'en-tête du résultat une fois le compte choisi, même après fermeture du sélecteur.
 */
export function PageGrandLivre() {
  const [compteId, setCompteId] = useState('')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [page, setPage] = useState(1)

  const comptesRequete = useQuery({
    queryKey: ['comptabilite', 'comptes-selecteur-rapport'],
    queryFn: () => listerComptesSelecteurRapport(),
  })

  const grandLivreRequete = useQuery({
    queryKey: ['comptabilite', 'grand-livre', compteId, dateDebut, dateFin, page],
    queryFn: () => chargerGrandLivre({ compteId, dateDebut, dateFin, page }),
    enabled: !!compteId,
    placeholderData: keepPreviousData,
  })

  const majFiltre = (setter: (v: string) => void) => (valeur: string) => {
    setter(valeur)
    setPage(1)
  }

  const reinitialiser = () => {
    setDateDebut('')
    setDateFin('')
    setPage(1)
  }

  const total = grandLivreRequete.data?.total ?? 0
  const taille = grandLivreRequete.data?.taille ?? 50
  const nbPages = Math.max(1, Math.ceil(total / taille))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{G.titre}</h1>
        <p className="text-sm text-muted-foreground">{G.sousTitre}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/20 p-3">
        <div className="space-y-1">
          <Label htmlFor="gl-compte">{G.choisirCompte}</Label>
          <select
            id="gl-compte"
            value={compteId}
            onChange={(e) => {
              setCompteId(e.target.value)
              setPage(1)
            }}
            className="h-9 w-72 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">{G.choisirComptePlaceholder}</option>
            {comptesRequete.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.is_active ? `${c.account_number} — ${c.name}` : G.optionDesactive(c.account_number, c.name)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="gl-debut">{G.filtreDateDebut}</Label>
          <Input
            id="gl-debut"
            type="date"
            value={dateDebut}
            onChange={(e) => majFiltre(setDateDebut)(e.target.value)}
            className="w-auto"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="gl-fin">{G.filtreDateFin}</Label>
          <Input
            id="gl-fin"
            type="date"
            value={dateFin}
            onChange={(e) => majFiltre(setDateFin)(e.target.value)}
            className="w-auto"
          />
        </div>
        {(dateDebut || dateFin) && (
          <Button type="button" variant="ghost" size="sm" onClick={reinitialiser}>
            {G.reinitialiser}
          </Button>
        )}
      </div>

      {!compteId ? (
        <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
          {G.aucunCompteChoisi}
        </p>
      ) : grandLivreRequete.isPending ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{G.chargement}</p>
      ) : grandLivreRequete.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {grandLivreRequete.error instanceof AxiosError &&
            grandLivreRequete.error.response?.status === 403
              ? G.interdit
              : G.erreur}
          </AlertDescription>
        </Alert>
      ) : (
        <Contenu
          donnees={grandLivreRequete.data}
          dateDebut={dateDebut}
          page={page}
          nbPages={nbPages}
          setPage={setPage}
        />
      )}
    </div>
  )
}

function Contenu({
  donnees,
  dateDebut,
  page,
  nbPages,
  setPage,
}: {
  donnees: Awaited<ReturnType<typeof chargerGrandLivre>>
  dateDebut: string
  page: number
  nbPages: number
  setPage: (updater: (p: number) => number) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-mono text-sm font-medium">{donnees.compte.account_number}</h2>
        <span className="text-sm text-muted-foreground">{donnees.compte.name}</span>
        {!donnees.compte.is_active && (
          <span title={G.compteDesactiveAide}>
            <Badge ton="neutral">{G.compteDesactive}</Badge>
          </span>
        )}
      </div>

      {dateDebut && (
        <p className="text-sm text-muted-foreground">
          {G.soldeOuverture(formatFcfa(donnees.solde_ouverture), dateDebut)}
        </p>
      )}

      {donnees.lignes.length === 0 ? (
        <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
          {G.vide}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{G.colonneDate}</th>
                <th className="px-3 py-2 text-left font-medium">{G.colonnePiece}</th>
                <th className="px-3 py-2 text-left font-medium">{G.colonneJournal}</th>
                <th className="px-3 py-2 text-left font-medium">{G.colonneLibelle}</th>
                <th className="px-3 py-2 text-right font-medium">{G.colonneDebit}</th>
                <th className="px-3 py-2 text-right font-medium">{G.colonneCredit}</th>
                <th className="px-3 py-2 text-right font-medium">{G.colonneSolde}</th>
              </tr>
            </thead>
            <tbody>
              {donnees.lignes.map((ligne, i) => (
                <LigneMouvement key={`${ligne.entry_number ?? 'x'}-${i}`} ligne={ligne} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {donnees.total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{G.total(donnees.total)}</span>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">{G.page(page, nbPages)}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {G.precedent}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= nbPages}
              onClick={() => setPage((p) => Math.min(nbPages, p + 1))}
            >
              {G.suivant}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function LigneMouvement({ ligne }: { ligne: LigneGrandLivre }) {
  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-2">{ligne.entry_date}</td>
      <td className="px-3 py-2 font-mono text-xs">{ligne.entry_number ?? '—'}</td>
      <td className="px-3 py-2 text-muted-foreground">{ligne.journal_code}</td>
      <td className="px-3 py-2">{ligne.label}</td>
      <td className="px-3 py-2 text-right tabular-nums">
        {ligne.side === 'D' ? formatFcfa(ligne.amount) : ''}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {ligne.side === 'C' ? formatFcfa(ligne.amount) : ''}
      </td>
      <td className="px-3 py-2 text-right font-medium tabular-nums">
        {formatFcfa(ligne.solde_cumule)}
      </td>
    </tr>
  )
}
