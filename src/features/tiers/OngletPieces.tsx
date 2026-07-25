import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAPermission } from '@/features/auth/useProfil'
import {
  ajouterPiece,
  definirPiecePrincipale,
  ErreurDoublonPiece,
  ErreurPiece,
  listerPieces,
  listerTypesPieces,
  supprimerPiece,
  verifierPiece,
  type Piece,
  type Validite,
} from '@/features/tiers/pieces'
import { listerPays } from '@/features/tiers/referentiels'
import { LIBELLES } from '@/libelles/fr'

const P = LIBELLES.tiersPieces
const SELECT =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs disabled:opacity-50'

/** Badge de validité — couleur selon l'état, visible d'un coup d'œil. Périmée = rouge. */
function BadgeValidite({ etat }: { etat: Validite }) {
  const style: Record<Validite, string> = {
    valide: 'bg-emerald-100 text-emerald-800',
    expire_bientot: 'bg-amber-100 text-amber-800',
    perimee: 'bg-red-100 text-red-800',
    sans_objet: 'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${style[etat]}`}>
      {P.validite[etat] ?? etat}
    </span>
  )
}

export function OngletPieces({ tierId }: { tierId: string }) {
  const peutGerer = useAPermission('tiers.update')
  const peutVerifier = useAPermission('tiers.identity.verify')
  const requete = useQuery({
    queryKey: ['tiers', 'pieces', tierId],
    queryFn: () => listerPieces(tierId),
  })
  const types = useQuery({ queryKey: ['types-pieces'], queryFn: listerTypesPieces })
  const pays = useQuery({ queryKey: ['pays'], queryFn: listerPays })

  const nomType = useMemo(() => {
    const table = new Map((types.data ?? []).map((t) => [t.id, t.name]))
    return (id: string) => table.get(id) ?? id
  }, [types.data])

  if (requete.isPending) {
    return <p className="py-4 text-sm text-muted-foreground">{P.chargement}</p>
  }
  if (requete.isError) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription>{P.erreur}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      {requete.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{P.vide}</p>
      ) : (
        <ul className="space-y-2">
          {requete.data.map((piece) => (
            <LignePiece
              key={piece.id}
              tierId={tierId}
              piece={piece}
              nomType={nomType(piece.document_type_id)}
              peutGerer={peutGerer}
              peutVerifier={peutVerifier}
            />
          ))}
        </ul>
      )}

      {peutGerer && (
        <FormPiece
          tierId={tierId}
          types={types.data ?? []}
          typesIndispo={types.isError}
          pays={pays.data ?? []}
        />
      )}
    </div>
  )
}

function LignePiece({
  tierId,
  piece,
  nomType,
  peutGerer,
  peutVerifier,
}: {
  tierId: string
  piece: Piece
  nomType: string
  peutGerer: boolean
  peutVerifier: boolean
}) {
  const queryClient = useQueryClient()
  const rafraichir = () => void queryClient.invalidateQueries({ queryKey: ['tiers'] })
  const [panneau, setPanneau] = useState<'verifier' | 'supprimer' | null>(null)
  const [note, setNote] = useState('')
  const [motif, setMotif] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)

  const principal = useMutation({
    mutationFn: () => definirPiecePrincipale(tierId, piece.id),
    onSuccess: rafraichir,
  })
  const verification = useMutation({
    mutationFn: () => verifierPiece(tierId, piece.id, note || null),
    onSuccess: () => {
      setPanneau(null)
      rafraichir()
    },
  })
  const suppression = useMutation({
    mutationFn: () => supprimerPiece(tierId, piece.id, motif || null),
    onSuccess: () => {
      setPanneau(null)
      rafraichir()
    },
    onError: (e) => setErreur(e instanceof ErreurPiece ? e.message : P.erreurGenerique),
  })

  return (
    <li className="rounded-md border p-2.5 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{nomType}</span>
            <span className="font-mono text-xs text-muted-foreground">{piece.document_number}</span>
            <BadgeValidite etat={piece.validite} />
            {piece.is_primary && (
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-800">
                {P.principale}
              </span>
            )}
            {piece.is_verified && (
              <span className="rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-800">
                ✓ {P.verifiee}
              </span>
            )}
          </div>
          {piece.expiry_date && (
            <p className="text-xs text-muted-foreground">
              {P.dateExpiration} : {new Date(piece.expiry_date).toLocaleDateString('fr-FR')}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {peutGerer && !piece.is_primary && (
            <button
              type="button"
              className="text-xs text-muted-foreground underline underline-offset-2"
              disabled={principal.isPending}
              onClick={() => principal.mutate()}
            >
              {P.definirPrincipale}
            </button>
          )}
          {peutVerifier && !piece.is_verified && (
            <button
              type="button"
              className="text-xs text-sky-700 underline underline-offset-2"
              onClick={() => {
                setErreur(null)
                setPanneau('verifier')
              }}
            >
              {P.verifier}
            </button>
          )}
          {peutGerer && (
            <button
              type="button"
              className="text-xs text-destructive underline underline-offset-2"
              onClick={() => {
                setErreur(null)
                setPanneau('supprimer')
              }}
            >
              {P.supprimer}
            </button>
          )}
        </div>
      </div>

      {panneau === 'verifier' && (
        <div className="mt-2 space-y-2 rounded border border-sky-300 bg-sky-50 p-2">
          <p className="text-sm font-medium">{P.verifierTitre}</p>
          <p className="text-sm text-muted-foreground">{P.verifierAide}</p>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={P.verifierNote}
            aria-label={P.verifierNote}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={verification.isPending}
              onClick={() => verification.mutate()}
            >
              {P.verifierConfirmer}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setPanneau(null)}>
              {P.annuler}
            </Button>
          </div>
        </div>
      )}

      {panneau === 'supprimer' && (
        <div className="mt-2 space-y-2 rounded border border-destructive/40 bg-destructive/5 p-2">
          <p className="text-sm font-medium">{P.supprimerTitre}</p>
          <Input
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder={P.motifPlaceholder}
            aria-label={P.motif}
          />
          {erreur && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{erreur}</AlertDescription>
            </Alert>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={suppression.isPending}
              onClick={() => suppression.mutate()}
            >
              {P.confirmerSuppression}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setPanneau(null)}>
              {P.annuler}
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}

function FormPiece({
  tierId,
  types,
  typesIndispo,
  pays,
}: {
  tierId: string
  types: { id: string; name: string; requires_expiry_date: boolean }[]
  typesIndispo: boolean
  pays: { id: string; name: string }[]
}) {
  const queryClient = useQueryClient()
  const [ouvert, setOuvert] = useState(false)
  const [typeId, setTypeId] = useState('')
  const [numero, setNumero] = useState('')
  const [autorite, setAutorite] = useState('')
  const [emission, setEmission] = useState('')
  const [expiration, setExpiration] = useState('')
  const [paysId, setPaysId] = useState('')
  const [principal, setPrincipal] = useState(false)
  const [doublon, setDoublon] = useState<ErreurDoublonPiece | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const typeChoisi = types.find((t) => t.id === typeId)

  const fermer = () => {
    setOuvert(false)
    setTypeId('')
    setNumero('')
    setAutorite('')
    setEmission('')
    setExpiration('')
    setPaysId('')
    setPrincipal(false)
    setDoublon(null)
    setErreur(null)
  }

  const mutation = useMutation({
    mutationFn: () =>
      ajouterPiece(tierId, {
        document_type_id: typeId,
        document_number: numero,
        issuing_authority: autorite.trim() || null,
        date_of_issue: emission || null,
        expiry_date: expiration || null,
        issuing_country_id: paysId || null,
        is_primary: principal,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tiers'] })
      fermer()
    },
    onError: (e) => {
      if (e instanceof ErreurDoublonPiece) setDoublon(e)
      else setErreur(P.erreurGenerique)
    },
  })

  const soumettre = () => {
    setDoublon(null)
    setErreur(null)
    mutation.mutate()
  }

  if (!ouvert) {
    return (
      <button
        type="button"
        className="text-sm text-primary underline underline-offset-2"
        onClick={() => setOuvert(true)}
      >
        + {P.ajouter}
      </button>
    )
  }

  return (
    <div className="rounded-md border p-3">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="piece-type">{P.type}</Label>
          <select
            id="piece-type"
            className={SELECT}
            value={typeId}
            disabled={typesIndispo}
            onChange={(e) => setTypeId(e.target.value)}
          >
            <option value="">{P.typeChoisir}</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {typesIndispo && <p className="text-sm text-destructive">{P.typesIndisponibles}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="piece-numero">{P.numero}</Label>
          <Input
            id="piece-numero"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder={P.numeroPlaceholder}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="piece-emission">{P.dateEmission}</Label>
            <Input id="piece-emission" type="date" value={emission} onChange={(e) => setEmission(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="piece-expiration">
              {typeChoisi?.requires_expiry_date ? P.dateExpiration : P.dateExpirationFacultative}
            </Label>
            <Input
              id="piece-expiration"
              type="date"
              value={expiration}
              onChange={(e) => setExpiration(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="piece-autorite">{P.autorite}</Label>
          <Input id="piece-autorite" value={autorite} onChange={(e) => setAutorite(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="piece-pays">{P.paysEmission}</Label>
          <select id="piece-pays" className={SELECT} value={paysId} onChange={(e) => setPaysId(e.target.value)}>
            <option value="">{P.paysChoisir}</option>
            {pays.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={principal} onChange={(e) => setPrincipal(e.target.checked)} />
          {P.marquerPrincipale}
        </label>

        {doublon && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>
              {doublon.message}{' '}
              {/* Actionnable seulement si la fiche est nommée (dans le périmètre). */}
              {doublon.tierId && (
                <Link to={`/tiers/${doublon.tierId}`} className="font-medium underline underline-offset-2">
                  {P.doublonLien}
                  {doublon.nom ? ` — ${doublon.nom}` : ''}
                </Link>
              )}
            </AlertDescription>
          </Alert>
        )}
        {erreur && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{erreur}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            disabled={mutation.isPending || !typeId || !numero.trim()}
            onClick={soumettre}
          >
            {mutation.isPending ? P.enCours : P.ajouterBouton}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={fermer}>
            {P.annuler}
          </Button>
        </div>
      </div>
    </div>
  )
}
