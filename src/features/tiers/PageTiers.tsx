import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAPermission } from '@/features/auth/useProfil'
import {
  ErreurListe,
  listerTiers,
  TAILLE_PAGE,
  type EchecListe,
  type LigneTier,
  type PageTiers as PageTiersData,
} from '@/features/tiers/api'
import { listerAgences } from '@/features/utilisateurs/agences'
import { useDebounce } from '@/lib/useDebounce'
import { LIBELLES } from '@/libelles/fr'

const T = LIBELLES.tiers

/** Pastille de statut. Une fiche naît en « prospect » : neutre, pas encore active. */
function Statut({ code }: { code: string }) {
  const base = 'inline-block rounded px-2 py-0.5 text-xs font-medium'
  const style =
    code === 'actif'
      ? 'bg-emerald-100 text-emerald-800'
      : code === 'prospect'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-gray-100 text-gray-700'
  return <span className={`${base} ${style}`}>{T.statuts[code] ?? code}</span>
}

export function PageTiers() {
  const [recherche, setRecherche] = useState('')
  const [page, setPage] = useState(1)
  const rechercheDifferee = useDebounce(recherche)
  const naviguer = useNavigate()

  const requete = useQuery({
    queryKey: ['tiers', rechercheDifferee, page],
    queryFn: () => listerTiers({ q: rechercheDifferee, page }),
    placeholderData: keepPreviousData,
  })

  // La liste ne renvoie que l'id de l'agence ; on résout le nom via le référentiel (mis en
  // cache, partagé avec le formulaire de création). Une agence absente (inactive) -> tiret.
  const agences = useQuery({ queryKey: ['agences'], queryFn: listerAgences })
  const nomAgence = useMemo(() => {
    const table = new Map((agences.data ?? []).map((a) => [a.id, a.name]))
    return (id: string) => table.get(id) ?? T.sansAgence
  }, [agences.data])

  const total = requete.data?.total ?? 0
  const nbPages = Math.max(1, Math.ceil(total / TAILLE_PAGE))

  const majRecherche = (valeur: string) => {
    setRecherche(valeur)
    setPage(1)
  }

  const peutCreer = useAPermission('tiers.create')

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{T.titre}</h1>
          <p className="text-sm text-muted-foreground">{T.sousTitre}</p>
        </div>
        {peutCreer && (
          <Link to="/tiers/nouveau" className={buttonVariants({ size: 'sm' })}>
            {LIBELLES.tiersCreation.bouton}
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

      <Contenu
        requete={requete}
        recherche={rechercheDifferee}
        nomAgence={nomAgence}
        onLigne={(id) => void naviguer(`/tiers/${id}`)}
      />

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

function Contenu({
  requete,
  recherche,
  nomAgence,
  onLigne,
}: {
  requete: UseQueryResult<PageTiersData, Error>
  recherche: string
  nomAgence: (id: string) => string
  onLigne: (id: string) => void
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
          <tr>
            <th className="px-3 py-2 text-left font-medium">{T.colonneNumero}</th>
            <th className="px-3 py-2 text-left font-medium">{T.colonneNom}</th>
            <th className="px-3 py-2 text-left font-medium">{T.colonneType}</th>
            <th className="px-3 py-2 text-left font-medium">{T.colonneAgence}</th>
            <th className="px-3 py-2 text-left font-medium">{T.colonneStatut}</th>
          </tr>
        </thead>
        <tbody>
          {requete.data.lignes.map((ligne: LigneTier) => (
            <tr
              key={ligne.id}
              tabIndex={0}
              role="button"
              onClick={() => onLigne(ligne.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onLigne(ligne.id)
              }}
              className="cursor-pointer border-b last:border-0 hover:bg-muted/30 focus:bg-muted/50 focus:outline-none"
            >
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{ligne.tier_number}</td>
              <td className="px-3 py-2">{ligne.display_name}</td>
              <td className="px-3 py-2">{T.types[ligne.tier_type] ?? ligne.tier_type}</td>
              <td className="px-3 py-2">{nomAgence(ligne.primary_agency_id)}</td>
              <td className="px-3 py-2">
                <Statut code={ligne.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
