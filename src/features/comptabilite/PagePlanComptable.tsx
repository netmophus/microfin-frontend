import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAPermission } from '@/features/auth/useProfil'
import {
  creerCompte,
  listerComptes,
  messageRefusCompte,
  TAILLE_PAGE,
  type CompteResume,
  type CreationCompte,
} from '@/features/comptabilite/api'
import { useDebounce } from '@/lib/useDebounce'
import { LIBELLES } from '@/libelles/fr'

const P = LIBELLES.planComptable

/**
 * Plan de comptes — consultation + création (Bloc 1 du paramétrage comptable). Institution-wide,
 * aucun cloisonnement par agence (à la différence des tiers). La recherche couvre numéro ET
 * libellé ; le filtre par classe et le bouton « afficher les désactivés » suivent le même
 * patron que la liste des tiers.
 */
export function PagePlanComptable() {
  const [recherche, setRecherche] = useState('')
  const [classe, setClasse] = useState<number | undefined>(undefined)
  const [inclureInactifs, setInclureInactifs] = useState(false)
  const [page, setPage] = useState(1)
  const [creationVisible, setCreationVisible] = useState(false)
  const rechercheDifferee = useDebounce(recherche)
  const naviguer = useNavigate()
  const client = useQueryClient()

  const peutGerer = useAPermission('compta.plan.manage')

  const requete = useQuery({
    queryKey: ['comptabilite', 'comptes', rechercheDifferee, classe, inclureInactifs, page],
    queryFn: () =>
      listerComptes({ q: rechercheDifferee, classe, inclureInactifs, page }),
    placeholderData: keepPreviousData,
  })

  const total = requete.data?.total ?? 0
  const nbPages = Math.max(1, Math.ceil(total / TAILLE_PAGE))

  const majRecherche = (valeur: string) => {
    setRecherche(valeur)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{P.titre}</h1>
          <p className="text-sm text-muted-foreground">{P.sousTitre}</p>
        </div>
        {peutGerer && !creationVisible && (
          <Button size="sm" onClick={() => setCreationVisible(true)}>
            <Plus className="mr-1 size-4" />
            {P.nouveauCompte}
          </Button>
        )}
      </div>

      {creationVisible && (
        <FormulaireCreation
          onFini={() => {
            setCreationVisible(false)
            void client.invalidateQueries({ queryKey: ['comptabilite', 'comptes'] })
          }}
          onAnnuler={() => setCreationVisible(false)}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            placeholder={P.rechercher}
            value={recherche}
            onChange={(e) => majRecherche(e.target.value)}
            className="pl-8"
            aria-label={P.rechercher}
          />
        </div>
        <select
          aria-label={P.filtreClasse}
          className="h-9 rounded-md border bg-background px-3 text-sm"
          value={classe ?? ''}
          onChange={(e) => {
            setClasse(e.target.value ? Number(e.target.value) : undefined)
            setPage(1)
          }}
        >
          <option value="">{P.toutesClasses}</option>
          {Array.from({ length: 9 }, (_, i) => i + 1).map((c) => (
            <option key={c} value={c}>
              {P.filtreClasse} {c}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={inclureInactifs}
            onChange={(e) => {
              setInclureInactifs(e.target.checked)
              setPage(1)
            }}
          />
          {P.afficherInactifs}
        </label>
      </div>

      {requete.isPending ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{P.chargement}</p>
      ) : requete.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {requete.error instanceof AxiosError && requete.error.response?.status === 403
              ? P.interdit
              : P.erreur}
          </AlertDescription>
        </Alert>
      ) : requete.data.lignes.length === 0 ? (
        <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
          {rechercheDifferee.trim() ? P.aucunResultat : P.listeVide}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{P.colonneNumero}</th>
                <th className="px-3 py-2 text-left font-medium">{P.colonneLibelle}</th>
                <th className="px-3 py-2 text-left font-medium">{P.colonneClasse}</th>
                <th className="px-3 py-2 text-left font-medium">{P.colonneSens}</th>
                <th className="px-3 py-2 text-left font-medium">{P.colonneNature}</th>
                <th className="px-3 py-2 text-left font-medium">{P.colonneStatut}</th>
              </tr>
            </thead>
            <tbody>
              {requete.data.lignes.map((ligne) => (
                <LigneCompte key={ligne.id} ligne={ligne} onClick={() => naviguer(`/comptabilite/plan/${ligne.id}`)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {requete.isSuccess && total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{P.total(total)}</span>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">{P.page(page, nbPages)}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {P.precedent}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= nbPages}
              onClick={() => setPage((p) => Math.min(nbPages, p + 1))}
            >
              {P.suivant}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function LigneCompte({ ligne, onClick }: { ligne: CompteResume; onClick: () => void }) {
  return (
    <tr
      tabIndex={0}
      role="button"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick()
      }}
      className="cursor-pointer border-b last:border-0 hover:bg-muted/30 focus:bg-muted/50 focus:outline-none"
    >
      <td className="px-3 py-2 font-mono text-xs">{ligne.account_number}</td>
      <td className="px-3 py-2">
        <span className="font-medium">{ligne.name}</span>
        {ligne.is_system && (
          <Badge ton="neutral" className="ml-2">
            {P.systeme}
          </Badge>
        )}
        {ligne.is_provisional && (
          <span title={P.provisoireAide} className="ml-2">
            <Badge ton="warning">{P.provisoire}</Badge>
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-muted-foreground">{ligne.account_class}</td>
      <td className="px-3 py-2 text-muted-foreground">{P.sens[ligne.normal_side] ?? ligne.normal_side}</td>
      <td className="px-3 py-2 text-muted-foreground">
        {ligne.is_posting ? P.nature.posting : P.nature.regroupement}
      </td>
      <td className="px-3 py-2">
        <Badge ton={ligne.is_active ? 'success' : 'neutral'}>
          {ligne.is_active ? P.actif : P.inactif}
        </Badge>
      </td>
    </tr>
  )
}

function FormulaireCreation({ onFini, onAnnuler }: { onFini: () => void; onAnnuler: () => void }) {
  const [numero, setNumero] = useState('')
  const [libelle, setLibelle] = useState('')
  const [libelleCourt, setLibelleCourt] = useState('')
  const [parent, setParent] = useState('')
  const [sens, setSens] = useState<'D' | 'C'>('D')
  const [saisie, setSaisie] = useState(true)
  const [notes, setNotes] = useState('')

  const classe = numero.length > 0 && /^\d/.test(numero) ? Number(numero[0]) : undefined

  const mutation = useMutation({
    mutationFn: () => {
      const donnees: CreationCompte = {
        account_number: numero.trim(),
        name: libelle.trim(),
        short_name: libelleCourt.trim() || null,
        account_class: classe ?? 0,
        parent_number: parent.trim() || null,
        normal_side: sens,
        is_posting: saisie,
        notes: notes.trim() || null,
      }
      return creerCompte(donnees)
    },
    onSuccess: onFini,
  })

  const valide = numero.trim() !== '' && libelle.trim() !== '' && classe !== undefined

  return (
    <form
      className="space-y-3 rounded-md border bg-brand-subtle/40 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (valide) mutation.mutate()
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="cc-numero">{P.creationNumero}</Label>
          <Input
            id="cc-numero"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder={P.creationNumeroPlaceholder}
            className="font-mono"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cc-libelle">{P.creationLibelle}</Label>
          <Input id="cc-libelle" value={libelle} onChange={(e) => setLibelle(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cc-libelle-court">{P.creationLibelleCourt}</Label>
          <Input
            id="cc-libelle-court"
            value={libelleCourt}
            onChange={(e) => setLibelleCourt(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cc-parent">{P.creationParent}</Label>
          <Input
            id="cc-parent"
            value={parent}
            onChange={(e) => setParent(e.target.value)}
            placeholder={P.creationParentPlaceholder}
            className="font-mono"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cc-sens">{P.creationSens}</Label>
          <select
            id="cc-sens"
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            value={sens}
            onChange={(e) => setSens(e.target.value as 'D' | 'C')}
          >
            <option value="D">{P.sens.D}</option>
            <option value="C">{P.sens.C}</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="cc-nature">{P.creationNature}</Label>
          <select
            id="cc-nature"
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            value={saisie ? 'saisie' : 'regroupement'}
            onChange={(e) => setSaisie(e.target.value === 'saisie')}
          >
            <option value="saisie">{P.creationNatureSaisie}</option>
            <option value="regroupement">{P.creationNatureRegroupement}</option>
          </select>
        </div>
      </div>
      {classe !== undefined && (
        <p className="text-xs text-muted-foreground">
          {P.colonneClasse} {classe} ({P.filtreClasse.toLowerCase()} déduite du numéro)
        </p>
      )}
      <div className="space-y-1">
        <Label htmlFor="cc-notes">{P.creationNotes}</Label>
        <Input id="cc-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {mutation.isError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{messageRefusCompte(mutation.error, P.creationEchec)}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!valide || mutation.isPending}>
          {mutation.isPending ? P.creationEnCours : P.creer}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onAnnuler}>
          {P.annuler}
        </Button>
      </div>
    </form>
  )
}
