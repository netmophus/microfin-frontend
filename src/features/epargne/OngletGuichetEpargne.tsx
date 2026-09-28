import { useMutation, useQuery } from '@tanstack/react-query'
import { PiggyBank, Search } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  deposerGuichet,
  formatFcfa,
  messageRefus,
  rechercherComptes,
  retirerGuichet,
  type CompteGuichet,
  type ResultatOperation,
} from '@/features/epargne/api'
import { BadgeProvisoire, BadgeStatutCompte } from '@/features/epargne/badges'
import { useDebounce } from '@/lib/useDebounce'
import { LIBELLES } from '@/libelles/fr'

const G = LIBELLES.guichet

function fmt(gabarit: string, valeurs: Record<string, string>): string {
  return gabarit.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '')
}

/**
 * Onglet « Épargne » du guichet — dépôt / retrait. Recherche assistée par numéro OU nom du
 * titulaire (même patron que l'onglet Crédit : debounce, liste de résultats, sélection) — un
 * caissier ne connaît pas le numéro de livret par cœur. Le NOM du titulaire est affiché en gros
 * AVANT toute opération (vérification humaine contre un mauvais choix dans la liste), et la
 * confirmation le répète. Refus serveur affichés tels quels. Cloisonnement côté serveur (la
 * recherche ne rend que les comptes de l'agence du caissier).
 */
export function OngletGuichetEpargne() {
  const [compte, setCompte] = useState<CompteGuichet | null>(null)

  return (
    <div className="mx-auto max-w-xl space-y-5 p-4">
      <p className="text-sm text-muted-foreground">{G.intro}</p>

      {!compte ? (
        <Recherche onSelection={setCompte} />
      ) : (
        <Operations
          compte={compte}
          onSolde={(s) => setCompte({ ...compte, balance: s })}
          onChangerRecherche={() => setCompte(null)}
        />
      )}
    </div>
  )
}

function Recherche({ onSelection }: { onSelection: (c: CompteGuichet) => void }) {
  const [q, setQ] = useState('')
  // Filtrage en direct dès la 1ère frappe (même patron que l'onglet Crédit) : le debounce
  // diffère seulement l'APPEL serveur, il n'attend jamais Entrée ni une saisie complète.
  const qDifferee = useDebounce(q)
  const recherche = useQuery({
    queryKey: ['epargne', 'recherche-comptes', qDifferee],
    queryFn: () => rechercherComptes(qDifferee.trim()),
    enabled: qDifferee.trim().length > 0,
  })

  return (
    <div className="space-y-2">
      <Label htmlFor="recherche-epargne-guichet">{G.rechercherLabel}</Label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id="recherche-epargne-guichet"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={G.rechercherPlaceholder}
          className="pl-8"
        />
      </div>

      {recherche.isFetching && (
        <p className="text-sm text-muted-foreground">{G.rechercheEnCours}</p>
      )}

      {!recherche.isFetching && recherche.isSuccess && recherche.data.length === 0 && (
        <Alert role="alert">
          <AlertDescription>{G.aucunResultat}</AlertDescription>
        </Alert>
      )}

      {!recherche.isFetching && recherche.isSuccess && recherche.data.length > 0 && (
        <ul className="divide-y rounded-md border bg-background text-sm">
          {recherche.data.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-muted/50"
                onClick={() => onSelection(c)}
              >
                <span>
                  <span className="font-medium">{c.membre_nom}</span>{' '}
                  <span className="font-mono text-xs text-muted-foreground">
                    {c.account_number}
                  </span>
                  <br />
                  <span className="text-xs text-muted-foreground">{c.product_name}</span>
                </span>
                <span className="text-right">
                  <span className="block font-mono text-sm tabular-nums">
                    {formatFcfa(c.balance)}
                  </span>
                  <BadgeStatutCompte statut={c.status} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Operations({
  compte,
  onSolde,
  onChangerRecherche,
}: {
  compte: CompteGuichet
  onSolde: (nouveauSolde: number) => void
  onChangerRecherche: () => void
}) {
  const [sens, setSens] = useState<'depot' | 'retrait' | null>(null)
  const [montant, setMontant] = useState('')
  const [confirmation, setConfirmation] = useState(false)
  const [succes, setSucces] = useState<string | null>(null)

  const montantNum = Number.parseInt(montant.replace(/\D/g, ''), 10) || 0

  const operation = useMutation<ResultatOperation, unknown, void>({
    mutationFn: () =>
      sens === 'depot'
        ? deposerGuichet(compte.id, montantNum)
        : retirerGuichet(compte.id, montantNum),
    onSuccess: (res) => {
      onSolde(res.nouveau_solde)
      const modele = sens === 'depot' ? G.succesDepot : G.succesRetrait
      setSucces(
        fmt(modele, {
          montant: formatFcfa(montantNum),
          piece: res.entry_number ?? '—',
          solde: formatFcfa(res.nouveau_solde),
        }),
      )
      setSens(null)
      setMontant('')
      setConfirmation(false)
    },
  })

  const ferme = compte.status !== 'actif'

  return (
    <section className="space-y-4 rounded-md border p-4">
      {/* Le compte, et surtout le TITULAIRE, en évidence. */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <PiggyBank className="mt-1 size-6 text-muted-foreground" />
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{G.membre}</p>
            <p className="text-lg font-bold">{compte.membre_nom}</p>
            <p className="font-mono text-sm text-muted-foreground">
              {compte.account_number} · {compte.product_name}{' '}
              {compte.is_provisional && <BadgeProvisoire />}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{G.solde}</p>
          <p className="text-xl font-semibold tabular-nums">{formatFcfa(compte.balance)}</p>
          <BadgeStatutCompte statut={compte.status} />
        </div>
      </div>

      <Button size="sm" variant="ghost" onClick={onChangerRecherche}>
        {G.changerRecherche}
      </Button>

      {ferme ? (
        <Alert role="note">
          <AlertDescription>{G.compteFerme}</AlertDescription>
        </Alert>
      ) : succes ? (
        <Alert role="status">
          <AlertDescription className="space-y-2">
            <p>{succes}</p>
            <Button size="sm" variant="ghost" onClick={() => setSucces(null)}>
              {G.autreOperation}
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={sens === 'depot' ? 'default' : 'outline'}
              onClick={() => {
                setSens('depot')
                setConfirmation(false)
              }}
            >
              {G.depot}
            </Button>
            <Button
              type="button"
              variant={sens === 'retrait' ? 'default' : 'outline'}
              onClick={() => {
                setSens('retrait')
                setConfirmation(false)
              }}
            >
              {G.retrait}
            </Button>
          </div>

          {sens && !confirmation && (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (montantNum > 0) setConfirmation(true)
              }}
            >
              <Label htmlFor="montant">{G.montantLabel}</Label>
              <Input
                id="montant"
                inputMode="numeric"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                placeholder={G.montantPlaceholder}
              />
              <Button type="submit" disabled={montantNum <= 0}>
                {G.continuer}
              </Button>
            </form>
          )}

          {sens && confirmation && (
            <div className="space-y-3 rounded-md border bg-brand-subtle/40 p-3">
              <p className="text-sm">
                {fmt(sens === 'depot' ? G.confirmerDepot : G.confirmerRetrait, {
                  montant: formatFcfa(montantNum),
                  numero: compte.account_number,
                })}
                <br />
                {/* Nom RÉPÉTÉ dans la confirmation. */}
                <span className="font-semibold">
                  {fmt(G.confirmerQuestion, { membre: compte.membre_nom })}
                </span>
              </p>
              {operation.isError && (
                <Alert variant="destructive" role="alert">
                  <AlertDescription>{messageRefus(operation.error, G.echec)}</AlertDescription>
                </Alert>
              )}
              <div className="flex gap-2">
                <Button onClick={() => operation.mutate()} disabled={operation.isPending}>
                  {operation.isPending ? G.enCours : G.confirmer}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmation(false)}>
                  {G.annuler}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
