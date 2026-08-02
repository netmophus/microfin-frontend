import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { FileDown, FileUp, Plus, Search } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAPermission } from '@/features/auth/useProfil'
import {
  apercevoirImportComptes,
  confirmerImportComptes,
  creerCompte,
  exporterComptes,
  listerComptes,
  messageRefusCompte,
  TAILLE_PAGE,
  type ApercuImportComptes,
  type CompteResume,
  type ConfirmationImportComptes,
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
  const [importExportVisible, setImportExportVisible] = useState(false)
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
        <div className="flex shrink-0 gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setImportExportVisible((v) => !v)}
          >
            <FileUp className="mr-1 size-4" />
            {P.importExportTitre}
          </Button>
          {peutGerer && !creationVisible && (
            <Button size="sm" onClick={() => setCreationVisible(true)}>
              <Plus className="mr-1 size-4" />
              {P.nouveauCompte}
            </Button>
          )}
        </div>
      </div>

      {importExportVisible && (
        <PanneauImportExport
          peutImporter={peutGerer}
          onImporte={() => void client.invalidateQueries({ queryKey: ['comptabilite', 'comptes'] })}
        />
      )}

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

/**
 * Import/export CSV (Bloc 2). Le flux d'import est en DEUX temps : « Aperçu » lit et valide
 * sans rien écrire (anomalies, ou le diff de ce qui changerait) ; « Confirmer » réécrit — le
 * MÊME fichier choisi une seule fois reste en mémoire côté écran, jamais reposé par
 * l'utilisateur. Lever le provisoire est un choix EXPLICITE (case décochée par défaut) : une
 * correction intermédiaire ne doit pas lever le drapeau par accident.
 */
function PanneauImportExport({
  peutImporter,
  onImporte,
}: {
  peutImporter: boolean
  onImporte: () => void
}) {
  const [inclureInactifsExport, setInclureInactifsExport] = useState(true)
  const exportMutation = useMutation({ mutationFn: () => exporterComptes(inclureInactifsExport) })

  const [fichier, setFichier] = useState<File | null>(null)
  const [apercu, setApercu] = useState<ApercuImportComptes | null>(null)
  const [motif, setMotif] = useState('')
  const [leverProvisoire, setLeverProvisoire] = useState(false)
  const [confirmation, setConfirmation] = useState<ConfirmationImportComptes | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const apercuMutation = useMutation({
    mutationFn: (f: File) => apercevoirImportComptes(f),
    onSuccess: setApercu,
  })

  const confirmerMutation = useMutation({
    mutationFn: () => {
      if (!fichier || !apercu?.empreinte) throw new Error('Aucun aperçu en cours.')
      return confirmerImportComptes({
        fichier,
        empreinte: apercu.empreinte,
        motif: motif.trim(),
        leverProvisoire,
      })
    },
    onSuccess: (donnees) => {
      setConfirmation(donnees)
      setApercu(null)
      onImporte()
    },
  })

  const recommencer = () => {
    setFichier(null)
    setApercu(null)
    setMotif('')
    setLeverProvisoire(false)
    setConfirmation(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const aDesChangements = !!apercu && (apercu.a_creer.length > 0 || apercu.a_modifier.length > 0)
  const motifValide = motif.trim().length >= 3

  return (
    <div className="space-y-4 rounded-md border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={inclureInactifsExport}
            onChange={(e) => setInclureInactifsExport(e.target.checked)}
          />
          {P.afficherInactifs}
        </label>
        <Button
          size="sm"
          variant="outline"
          disabled={exportMutation.isPending}
          onClick={() => exportMutation.mutate()}
        >
          <FileDown className="mr-1 size-4" />
          {exportMutation.isPending ? P.exportEnCours : P.exporter}
        </Button>
      </div>

      {exportMutation.isError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {messageRefusCompte(exportMutation.error, P.exportEchec)}
          </AlertDescription>
        </Alert>
      )}

      {peutImporter && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="pce-fichier">{P.importerFichier}</Label>
              <input
                id="pce-fichier"
                ref={inputRef}
                type="file"
                accept=".csv"
                className="block text-sm"
                onChange={(e) => {
                  setFichier(e.target.files?.[0] ?? null)
                  setApercu(null)
                  setConfirmation(null)
                }}
              />
            </div>
            <Button
              size="sm"
              disabled={!fichier || apercuMutation.isPending}
              onClick={() => fichier && apercuMutation.mutate(fichier)}
            >
              {apercuMutation.isPending ? P.apercuEnCours : P.importerApercu}
            </Button>
            {(apercu ?? confirmation) && (
              <Button size="sm" variant="ghost" onClick={recommencer}>
                {P.recommencer}
              </Button>
            )}
          </div>

          {apercuMutation.isError && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>
                {messageRefusCompte(apercuMutation.error, P.apercuEchec)}
              </AlertDescription>
            </Alert>
          )}

          {confirmation && (
            <Alert role="status">
              <AlertDescription>
                {P.importReussi(confirmation.crees, confirmation.mis_a_jour)}
              </AlertDescription>
            </Alert>
          )}

          {apercu && apercu.anomalies.length > 0 && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>
                <p className="font-medium">{P.anomaliesTitre(apercu.anomalies.length)}</p>
                <ul className="mt-1 list-disc pl-5 text-xs">
                  {apercu.anomalies.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {apercu && apercu.anomalies.length === 0 && !confirmation && (
            <div className="space-y-3 rounded-md border p-3">
              {!aDesChangements ? (
                <p className="text-sm text-muted-foreground">{P.apercuRienAFaire}</p>
              ) : (
                <>
                  {apercu.a_creer.length > 0 && (
                    <div>
                      <p className="text-sm font-medium">
                        {P.apercuCreesTitre(apercu.a_creer.length)}
                      </p>
                      <ul className="mt-1 text-xs text-muted-foreground">
                        {apercu.a_creer.map((c) => (
                          <li key={c.account_number} className="font-mono">
                            {c.account_number} — {c.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {apercu.a_modifier.length > 0 && (
                    <div>
                      <p className="text-sm font-medium">
                        {P.apercuModifiesTitre(apercu.a_modifier.length)}
                      </p>
                      <ul className="mt-1 space-y-1 text-xs">
                        {apercu.a_modifier.map((c) => (
                          <li key={c.account_number}>
                            <span className="font-mono">{c.account_number}</span> — {c.name}
                            <ul className="pl-4 text-muted-foreground">
                              {c.diffs.map((d) => (
                                <li key={d.champ}>
                                  {d.champ} : {d.avant} → {d.apres}
                                </li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {P.apercuInchanges(apercu.inchanges)}
                  </p>
                </>
              )}

              {aDesChangements && (
                <div className="space-y-2 border-t pt-3">
                  <div className="space-y-1">
                    <Label htmlFor="pce-motif">{P.importerMotif}</Label>
                    <Input
                      id="pce-motif"
                      value={motif}
                      onChange={(e) => setMotif(e.target.value)}
                      placeholder={P.importerMotifPlaceholder}
                    />
                  </div>
                  <label className="flex items-start gap-1.5 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={leverProvisoire}
                      onChange={(e) => setLeverProvisoire(e.target.checked)}
                      className="mt-0.5"
                    />
                    {P.leverProvisoire}
                  </label>

                  {confirmerMutation.isError && (
                    <Alert variant="destructive" role="alert">
                      <AlertDescription>
                        {messageRefusCompte(confirmerMutation.error, P.confirmationEchec)}
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    size="sm"
                    disabled={!motifValide || confirmerMutation.isPending}
                    onClick={() => confirmerMutation.mutate()}
                  >
                    {confirmerMutation.isPending ? P.confirmationEnCours : P.confirmerImport}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
