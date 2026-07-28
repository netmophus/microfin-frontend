import { useMutation } from '@tanstack/react-query'
import { AxiosError } from 'axios'
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
  rechercherCompte,
  retirerGuichet,
  type CompteGuichet,
  type ResultatOperation,
} from '@/features/epargne/api'
import { BadgeProvisoire, BadgeStatutCompte } from '@/features/epargne/badges'
import { LIBELLES } from '@/libelles/fr'

const G = LIBELLES.guichet

function fmt(gabarit: string, valeurs: Record<string, string>): string {
  return gabarit.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '')
}

/**
 * Écran de guichet — le poste de travail du caissier. Un seul point d'entrée rapide : le numéro
 * du livret. Le NOM du titulaire est affiché en gros AVANT toute opération (vérification humaine
 * contre une faute de frappe dans le numéro), et la confirmation le répète. Refus serveur affichés
 * tels quels. Cloisonnement côté serveur (un compte hors agence est introuvable).
 */
export function PageGuichet() {
  const [compte, setCompte] = useState<CompteGuichet | null>(null)

  return (
    <div className="mx-auto max-w-xl space-y-5 p-4">
      <header>
        <h1 className="text-xl font-semibold">{G.titre}</h1>
        <p className="text-sm text-muted-foreground">{G.intro}</p>
      </header>

      <Recherche onTrouve={setCompte} />

      {compte && <Operations compte={compte} onSolde={(s) => setCompte({ ...compte, balance: s })} />}
    </div>
  )
}

function Recherche({ onTrouve }: { onTrouve: (c: CompteGuichet) => void }) {
  const [numero, setNumero] = useState('')
  const recherche = useMutation({
    mutationFn: () => rechercherCompte(numero.trim()),
    onSuccess: onTrouve,
  })
  const introuvable =
    recherche.isError && recherche.error instanceof AxiosError && recherche.error.response?.status === 404

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (numero.trim()) recherche.mutate()
      }}
    >
      <Label htmlFor="numero-compte">{G.numeroLabel}</Label>
      <div className="flex gap-2">
        <Input
          id="numero-compte"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          placeholder={G.numeroPlaceholder}
          className="font-mono"
        />
        <Button type="submit" disabled={!numero.trim() || recherche.isPending}>
          <Search className="mr-1 size-4" />
          {recherche.isPending ? G.rechercheEnCours : G.chercher}
        </Button>
      </div>
      {introuvable && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{G.introuvable}</AlertDescription>
        </Alert>
      )}
    </form>
  )
}

function Operations({
  compte,
  onSolde,
}: {
  compte: CompteGuichet
  onSolde: (nouveauSolde: number) => void
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
