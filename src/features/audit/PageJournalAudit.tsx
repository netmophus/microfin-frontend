import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ErreurAudit,
  listerAudit,
  TAILLE_PAGE,
  type EchecAudit,
  type FiltresAudit,
  type LigneAudit,
} from '@/features/audit/api'
import { LIBELLES } from '@/libelles/fr'

const A = LIBELLES.audit

/** Traduit un code d'action en français lisible ; à défaut, le code brut (visible, donc
 *  signalé comme oubli à corriger dans la table de correspondance). */
function libelleAction(code: string): string {
  return A.actions[code] ?? code
}

function formaterDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function messageEchec(echec: EchecAudit): string {
  return echec.type === 'interdit'
    ? A.interdit
    : echec.type === 'reseau'
      ? LIBELLES.erreurs.serveurInjoignable
      : A.erreur
}

export function PageJournalAudit() {
  const [action, setAction] = useState('')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [page, setPage] = useState(1)

  const filtres: FiltresAudit = { action, dateDebut, dateFin, page }

  const requete = useQuery({
    queryKey: ['audit', action, dateDebut, dateFin, page],
    queryFn: () => listerAudit(filtres),
    placeholderData: keepPreviousData,
  })

  const total = requete.data?.total ?? 0
  const nbPages = Math.max(1, Math.ceil(total / TAILLE_PAGE))

  // Toute modification de filtre repart en page 1 : rester en page 3 d'un résultat plus
  // court afficherait un tableau vide trompeur.
  const majFiltre = (setter: (v: string) => void) => (valeur: string) => {
    setter(valeur)
    setPage(1)
  }

  const reinitialiser = () => {
    setAction('')
    setDateDebut('')
    setDateFin('')
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{A.titre}</h1>
        <p className="text-sm text-muted-foreground">{A.sousTitre}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/20 p-3">
        <div className="space-y-1">
          <Label htmlFor="filtre-action">{A.filtreAction}</Label>
          <select
            id="filtre-action"
            value={action}
            onChange={(e) => majFiltre(setAction)(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">{A.filtreActionToutes}</option>
            {Object.entries(A.actions).map(([code, libelle]) => (
              <option key={code} value={code}>
                {libelle}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="filtre-debut">{A.filtreDateDebut}</Label>
          <Input
            id="filtre-debut"
            type="date"
            value={dateDebut}
            onChange={(e) => majFiltre(setDateDebut)(e.target.value)}
            className="w-auto"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="filtre-fin">{A.filtreDateFin}</Label>
          <Input
            id="filtre-fin"
            type="date"
            value={dateFin}
            onChange={(e) => majFiltre(setDateFin)(e.target.value)}
            className="w-auto"
          />
        </div>
        {(action || dateDebut || dateFin) && (
          <Button type="button" variant="ghost" size="sm" onClick={reinitialiser}>
            {A.reinitialiser}
          </Button>
        )}
      </div>

      <Contenu requete={requete} />

      {requete.isSuccess && total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{A.total(total)}</span>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">{A.page(page, nbPages)}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {A.precedent}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= nbPages}
              onClick={() => setPage((p) => Math.min(nbPages, p + 1))}
            >
              {A.suivant}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function Contenu({ requete }: { requete: ReturnType<typeof useQuery<Awaited<ReturnType<typeof listerAudit>>, Error>> }) {
  if (requete.isPending) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{A.chargement}</p>
  }
  if (requete.isError) {
    const echec: EchecAudit =
      requete.error instanceof ErreurAudit ? requete.error.echec : { type: 'inattendue' }
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription>{messageEchec(echec)}</AlertDescription>
      </Alert>
    )
  }
  if (requete.data.total === 0) {
    return (
      <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
        {A.aucuneEntree}
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-3 py-2 text-left font-medium">{A.colonneDate}</th>
            <th className="px-3 py-2 text-left font-medium">{A.colonneAction}</th>
            <th className="px-3 py-2 text-left font-medium">{A.colonneActeur}</th>
            <th className="px-3 py-2 text-left font-medium">{A.colonneCible}</th>
            <th className="px-3 py-2 text-left font-medium">{A.colonneDetail}</th>
          </tr>
        </thead>
        <tbody>
          {requete.data.lignes.map((ligne) => (
            <Rangee key={ligne.id} ligne={ligne} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Rangee({ ligne }: { ligne: LigneAudit }) {
  const [ouvert, setOuvert] = useState(false)
  const aDetail = Boolean(ligne.old_values || ligne.new_values || ligne.ip_address)

  return (
    <>
      <tr className="border-b last:border-0">
        <td className="whitespace-nowrap px-3 py-2">{formaterDate(ligne.occurred_at)}</td>
        <td className="px-3 py-2">{libelleAction(ligne.action)}</td>
        {/* Acteur système (pas d'utilisateur) : événements d'authentification anonymes. */}
        <td className="px-3 py-2">{ligne.acteur_nom ?? A.systeme}</td>
        <td className="px-3 py-2">{ligne.cible_nom ?? A.sansValeur}</td>
        <td className="px-3 py-2">
          {aDetail ? (
            <button
              type="button"
              onClick={() => setOuvert((o) => !o)}
              aria-expanded={ouvert}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              {ouvert ? A.masquerDetail : A.voirDetail}
            </button>
          ) : (
            <span className="text-muted-foreground">{A.sansValeur}</span>
          )}
        </td>
      </tr>
      {ouvert && aDetail && (
        <tr className="border-b bg-muted/20 last:border-0">
          <td colSpan={5} className="px-3 py-3">
            <Detail ligne={ligne} />
          </td>
        </tr>
      )}
    </>
  )
}

function Detail({ ligne }: { ligne: LigneAudit }) {
  return (
    <div className="space-y-2 text-xs">
      {ligne.ip_address && (
        <p>
          <span className="font-medium">{A.adresseIp} :</span> {ligne.ip_address}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {ligne.old_values && <Valeurs titre={A.avant} valeurs={ligne.old_values} />}
        {ligne.new_values && <Valeurs titre={A.apres} valeurs={ligne.new_values} />}
      </div>
    </div>
  )
}

function Valeurs({ titre, valeurs }: { titre: string; valeurs: Record<string, unknown> }) {
  return (
    <div className="rounded border bg-background p-2">
      <p className="mb-1 font-medium">{titre}</p>
      <dl className="space-y-0.5">
        {Object.entries(valeurs).map(([cle, valeur]) => (
          <div key={cle} className="flex gap-2">
            <dt className="text-muted-foreground">{cle} :</dt>
            <dd className="break-all">{String(valeur)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
