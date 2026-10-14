import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAPermission } from '@/features/auth/useProfil'
import {
  listerDocuments,
  ouvrirPdf,
  regenererDocument,
  telechargerBrouillon,
  telechargerDocument,
  type DocumentResume,
  type EtatBrouillon,
  type FiltresDocuments,
} from '@/features/documents/api'
import { messageDocument } from '@/features/documents/erreurs'
import { formatJour } from '@/features/epargne/api'
import { LIBELLES } from '@/libelles/fr'

const D = LIBELLES.documentsDuJour
const TAILLE_PAGE = 25
const LIGNES_SQUELETTE = 6
const COLONNES = 7
const CLASSE_SELECT =
  'h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring'

function fmt(gabarit: string, valeurs: Record<string, string>): string {
  return gabarit.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '')
}

function libelleType(type: string): string {
  return D.types[type] ?? D.typeInconnu
}

function libelleModule(module: string): string {
  return (D.modules as Record<string, string>)[module] ?? module
}

function Squelette() {
  return (
    <>
      {Array.from({ length: LIGNES_SQUELETTE }, (_, i) => (
        <tr key={i} className="border-b last:border-0" aria-hidden="true">
          {Array.from({ length: COLONNES }, (_, j) => (
            <td key={j} className="px-3 py-2">
              <div className="h-4 rounded bg-muted motion-safe:animate-pulse" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

function Brouillons() {
  const peutLire = useAPermission('compta.rapport.read')
  const brouillon = useMutation({
    mutationFn: async (etat: EtatBrouillon) => {
      ouvrirPdf(await telechargerBrouillon(etat), `brouillon_${etat}.pdf`)
    },
  })
  if (!peutLire) return null
  return (
    <section className="space-y-2 rounded-md border p-3" aria-labelledby="titre-brouillons">
      <h2 id="titre-brouillons" className="text-base font-semibold">
        {D.brouillonsTitre}
      </h2>
      <p className="text-sm text-muted-foreground">{D.brouillonsIntro}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={brouillon.isPending}
          onClick={() => brouillon.mutate('journal-du-jour')}
        >
          {D.brouillonJournal}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={brouillon.isPending}
          onClick={() => brouillon.mutate('balance-du-jour')}
        >
          {D.brouillonBalance}
        </Button>
      </div>
      {brouillon.isError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{messageDocument(brouillon.error, D.brouillonEchec)}</AlertDescription>
        </Alert>
      )}
    </section>
  )
}

/**
 * « Documents du jour » : les documents archivés par le serveur, filtrables par journée, module et
 * type, paginés côté serveur. Le périmètre (les siens pour un caissier, l'agence pour un
 * responsable, le réseau pour la comptabilité) est décidé par le serveur : cet écran affiche ce
 * qui revient, rien de plus.
 */
export function PageDocuments() {
  const client = useQueryClient()
  const [filtres, setFiltres] = useState<FiltresDocuments>({})
  const [page, setPage] = useState(1)

  const requete = useQuery({
    queryKey: ['documents', filtres, page],
    queryFn: () => listerDocuments(filtres, page, TAILLE_PAGE),
  })

  const action = useMutation({
    mutationFn: async ({ ligne, regenerer }: { ligne: DocumentResume; regenerer: boolean }) => {
      if (regenerer) {
        await regenererDocument(ligne.id)
        await client.invalidateQueries({ queryKey: ['documents'] })
        return
      }
      ouvrirPdf(await telechargerDocument(ligne.id), ligne.nom_fichier)
    },
  })

  function changer(partiel: Partial<FiltresDocuments>) {
    setFiltres((courants) => ({ ...courants, ...partiel }))
    setPage(1)
  }

  const filtreActif = Boolean(filtres.journee || filtres.module || filtres.type)
  const total = requete.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / TAILLE_PAGE))
  const enEchec = requete.data?.lignes.filter((ligne) => ligne.statut === 'echec').length ?? 0

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <FileText className="size-5 text-muted-foreground" />
          {D.titre}
        </h1>
        <p className="text-sm text-muted-foreground">{D.intro}</p>
      </header>

      <Brouillons />

      <section aria-label={D.filtresTitre} className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="filtre-journee">{D.filtreJournee}</Label>
          <Input
            id="filtre-journee"
            type="date"
            value={filtres.journee ?? ''}
            onChange={(e) => changer({ journee: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="filtre-module">{D.filtreModule}</Label>
          <select
            id="filtre-module"
            className={CLASSE_SELECT}
            value={filtres.module ?? ''}
            onChange={(e) => changer({ module: e.target.value })}
          >
            <option value="">{D.tous}</option>
            {Object.entries(D.modules).map(([code, libelle]) => (
              <option key={code} value={code}>
                {libelle}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="filtre-type">{D.filtreType}</Label>
          <select
            id="filtre-type"
            className={CLASSE_SELECT}
            value={filtres.type ?? ''}
            onChange={(e) => changer({ type: e.target.value })}
          >
            <option value="">{D.tous}</option>
            {Object.entries(D.types).map(([code, libelle]) => (
              <option key={code} value={code}>
                {libelle}
              </option>
            ))}
          </select>
        </div>
        {filtreActif && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFiltres({})
              setPage(1)
            }}
          >
            {D.reinitialiser}
          </Button>
        )}
      </section>

      {requete.isError && (
        <div className="space-y-3">
          <Alert variant="destructive" role="alert">
            <AlertDescription>{D.erreur}</AlertDescription>
          </Alert>
          <Button variant="outline" onClick={() => requete.refetch()}>
            {D.reessayer}
          </Button>
        </div>
      )}

      {enEchec > 0 && (
        <Alert role="status">
          <AlertDescription>{fmt(D.partiel, { nombre: String(enEchec) })}</AlertDescription>
        </Alert>
      )}

      {action.isError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{messageDocument(action.error, D.actionEchec)}</AlertDescription>
        </Alert>
      )}

      {!requete.isError &&
        (requete.data?.lignes.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            {filtreActif ? D.videAvecFiltre : D.videSansFiltre}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm" aria-busy={requete.isPending}>
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">{D.colJournee}</th>
                    <th className="px-3 py-2 font-medium">{D.colType}</th>
                    <th className="px-3 py-2 font-medium">{D.colModule}</th>
                    <th className="px-3 py-2 font-medium">{D.colPiece}</th>
                    <th className="px-3 py-2 font-medium">{D.colFichier}</th>
                    <th className="px-3 py-2 font-medium">{D.colStatut}</th>
                    <th className="px-3 py-2 font-medium">{D.colActions}</th>
                  </tr>
                </thead>
                <tbody>
                  {requete.isPending ? (
                    <Squelette />
                  ) : (
                    requete.data.lignes.map((ligne) => (
                      <tr key={ligne.id} className="border-b last:border-0">
                        <td className="px-3 py-2 font-mono tabular-nums">
                          {formatJour(ligne.journee_comptable)}
                        </td>
                        <td className="px-3 py-2">{libelleType(ligne.type)}</td>
                        <td className="px-3 py-2">{libelleModule(ligne.module)}</td>
                        <td className="px-3 py-2 font-mono tabular-nums">{ligne.numero_piece ?? '—'}</td>
                        <td className="px-3 py-2 font-mono text-xs">{ligne.nom_fichier}</td>
                        <td className="px-3 py-2">{ligne.statut === 'ok' ? D.statutOk : D.statutEchec}</td>
                        <td className="px-3 py-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={action.isPending}
                            onClick={() => action.mutate({ ligne, regenerer: ligne.statut === 'echec' })}
                          >
                            {ligne.statut === 'ok' ? D.telecharger : D.regenerer}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <p>
                {fmt(D.pagination, {
                  page: String(page),
                  total: String(totalPages),
                  nombre: String(total),
                })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page <= 1}
                >
                  {D.pagePrecedente}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages}
                >
                  {D.pageSuivante}
                </Button>
              </div>
            </div>
          </div>
        ))}
    </div>
  )
}
