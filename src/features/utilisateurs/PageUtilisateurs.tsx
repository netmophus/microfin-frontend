import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAPermission } from '@/features/auth/useProfil'
import {
  ErreurListe,
  listerUtilisateurs,
  TAILLE_PAGE,
  type EchecListe,
  type LigneUtilisateur,
  type PageUtilisateurs,
} from '@/features/utilisateurs/api'
import { useDebounce } from '@/lib/useDebounce'
import { LIBELLES } from '@/libelles/fr'

const T = LIBELLES.utilisateurs

/** Pastille de statut : le cas le plus urgent l'emporte — verrouillé prime sur inactif. */
function Statut({ ligne }: { ligne: LigneUtilisateur }) {
  const classe = 'inline-block rounded px-2 py-0.5 text-xs font-medium'
  if (ligne.is_locked) {
    return <span className={`${classe} bg-red-100 text-red-800`}>{T.verrouille}</span>
  }
  if (!ligne.is_active) {
    return <span className={`${classe} bg-gray-100 text-gray-700`}>{T.inactif}</span>
  }
  return <span className={`${classe} bg-emerald-100 text-emerald-800`}>{T.actif}</span>
}

const colonne = createColumnHelper<LigneUtilisateur>()

export function PageUtilisateurs() {
  const [recherche, setRecherche] = useState('')
  const [page, setPage] = useState(1)
  const rechercheDifferee = useDebounce(recherche)

  const colonnes = useMemo(
    () => [
      colonne.accessor('matricule', { header: T.colonneMatricule }),
      colonne.accessor('last_name', { header: T.colonneNom }),
      colonne.accessor('first_name', { header: T.colonnePrenom }),
      colonne.accessor('email', { header: T.colonneEmail }),
      colonne.accessor((l) => l.agence?.name ?? T.sansAgence, {
        id: 'agence',
        header: T.colonneAgence,
      }),
      colonne.display({
        id: 'statut',
        header: T.colonneStatut,
        cell: (contexte) => <Statut ligne={contexte.row.original} />,
      }),
    ],
    [],
  )

  const requete = useQuery({
    // La recherche différée fait partie de la clé : changer de terme relance la requête, et
    // le résultat est mis en cache par (terme, page).
    queryKey: ['utilisateurs', rechercheDifferee, page],
    queryFn: () => listerUtilisateurs({ q: rechercheDifferee, page }),
    // Garde la page précédente affichée pendant le chargement de la suivante : pas d'écran
    // blanc entre deux pages.
    placeholderData: keepPreviousData,
  })

  // useReactTable est signalé « incompatible library » par le plugin react-hooks : le React
  // Compiler renonce à optimiser ce composant, car il ne sait pas raisonner sur l'état
  // interne de TanStack Table. C'est informatif, pas un défaut — et hors de notre contrôle.
  // On le tait ici seul plutôt que de désactiver la règle globalement.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: requete.data?.lignes ?? [],
    columns: colonnes,
    getCoreRowModel: getCoreRowModel(),
  })

  const total = requete.data?.total ?? 0
  const nbPages = Math.max(1, Math.ceil(total / TAILLE_PAGE))

  const majRecherche = (valeur: string) => {
    setRecherche(valeur)
    // Toute nouvelle recherche repart de la première page : rester en page 3 d'un résultat
    // qui n'en compte qu'une afficherait un tableau vide trompeur.
    setPage(1)
  }

  // Le bouton de création n'apparaît QUE si la personne détient users.create — inutile de
  // proposer une action que le serveur refuserait (403). Le serveur reste l'autorité.
  const peutCreer = useAPermission('users.create')

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{T.titre}</h1>
          <p className="text-sm text-muted-foreground">{T.sousTitre}</p>
        </div>
        {peutCreer && (
          <Link to="/utilisateurs/nouveau" className={buttonVariants({ size: 'sm' })}>
            {LIBELLES.creation.bouton}
          </Link>
        )}
      </div>

      <Input
        type="search"
        placeholder={T.rechercher}
        value={recherche}
        onChange={(e) => majRecherche(e.target.value)}
        className="max-w-sm"
        aria-label={T.rechercher}
      />

      <ContenuListe requete={requete} table={table} recherche={rechercheDifferee} />

      {requete.isSuccess && total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{T.total(total)}</span>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">{T.page(page, nbPages)}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {T.precedent}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= nbPages}
              onClick={() => setPage((p) => Math.min(nbPages, p + 1))}
            >
              {T.suivant}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Isole les états de la requête pour garder le composant principal lisible. */
function ContenuListe({
  requete,
  table,
  recherche,
}: {
  // Erreur typée `Error` : c'est ce que rend useQuery par défaut. Le vrai type ErreurListe
  // est retrouvé plus bas par un `instanceof`, seul moyen fiable de le narrower.
  requete: UseQueryResult<PageUtilisateurs, Error>
  table: ReturnType<typeof useReactTable<LigneUtilisateur>>
  recherche: string
}) {
  if (requete.isPending) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{T.chargement}</p>
  }

  if (requete.isError) {
    const echec: EchecListe =
      requete.error instanceof ErreurListe ? requete.error.echec : { type: 'inattendue' }
    const message =
      echec.type === 'interdit'
        ? T.interdit
        : echec.type === 'reseau'
          ? LIBELLES.erreurs.serveurInjoignable
          : T.erreur
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    )
  }

  if (requete.data.total === 0) {
    // Deux vides distincts : une recherche sans résultat n'est pas une base vide.
    return (
      <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
        {recherche.trim() ? T.aucunResultat : T.listeVide}
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50">
          {table.getHeaderGroups().map((groupe) => (
            <tr key={groupe.id}>
              {groupe.headers.map((entete) => (
                <th key={entete.id} className="px-3 py-2 text-left font-medium">
                  {flexRender(entete.column.columnDef.header, entete.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((rangee) => (
            <tr key={rangee.id} className="border-b last:border-0 hover:bg-muted/30">
              {rangee.getVisibleCells().map((cellule) => (
                <td key={cellule.id} className="px-3 py-2">
                  {flexRender(cellule.column.columnDef.cell, cellule.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
