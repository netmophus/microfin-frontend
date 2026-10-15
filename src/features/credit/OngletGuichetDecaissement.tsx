import { useMutation, useQuery } from '@tanstack/react-query'
import { Banknote, Search } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  decaisserDemandeCredit,
  lireApercuDecaissementGuichet,
  messageRefusCredit,
  rechercherDecaissements,
  type DemandeCreditDecaissee,
  type DossierDecaissable,
} from '@/features/credit/api'
import { TableEcheances } from '@/features/credit/PageDossierCredit'
import { formatFcfa } from '@/features/epargne/api'
import { useDebounce } from '@/lib/useDebounce'
import { LIBELLES } from '@/libelles/fr'

const G = LIBELLES.guichetDecaissement

function fmt(gabarit: string, valeurs: Record<string, string>): string {
  return gabarit.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '')
}

/**
 * Onglet « Décaissement » du guichet — le caissier décaisse en espèces un crédit déjà approuvé,
 * depuis SA session de caisse. Calqué sur l'onglet Crédit (remboursement) : recherche en temps
 * réel par numéro de dossier, numéro de tiers ou nom, récapitulatif avec l'échéancier AVANT de
 * décaisser, confirmation qui répète le nom du tiers. Le montant n'est jamais saisi : c'est le
 * montant accordé par le comité. Le serveur reste gardien — session de caisse ouverte et caisse
 * suffisamment garnie sont vérifiées chez lui, et ses refus sont affichés tels quels.
 */
export function OngletGuichetDecaissement() {
  const [dossier, setDossier] = useState<DossierDecaissable | null>(null)

  return (
    <div className="mx-auto max-w-xl space-y-5 p-4">
      <p className="text-sm text-muted-foreground">{G.intro}</p>

      {!dossier ? (
        <Recherche onSelection={setDossier} />
      ) : (
        <Fiche dossier={dossier} onChangerRecherche={() => setDossier(null)} />
      )}
    </div>
  )
}

function Recherche({ onSelection }: { onSelection: (d: DossierDecaissable) => void }) {
  const [q, setQ] = useState('')
  const qDifferee = useDebounce(q)
  const recherche = useQuery({
    queryKey: ['credit', 'recherche-decaissement', qDifferee],
    queryFn: () => rechercherDecaissements(qDifferee.trim()),
    enabled: qDifferee.trim().length > 0,
  })

  return (
    <div className="space-y-2">
      <Label htmlFor="recherche-decaissement-guichet">{G.rechercherLabel}</Label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id="recherche-decaissement-guichet"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={G.rechercherPlaceholder}
          className="pl-8"
        />
      </div>

      {recherche.isFetching && <p className="text-sm text-muted-foreground">{G.rechercheEnCours}</p>}

      {recherche.isError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{messageRefusCredit(recherche.error, G.rechercheErreur)}</AlertDescription>
        </Alert>
      )}

      {!recherche.isFetching && recherche.isSuccess && recherche.data.length === 0 && (
        <Alert role="alert">
          <AlertDescription>{G.aucunResultat}</AlertDescription>
        </Alert>
      )}

      {!recherche.isFetching && recherche.isSuccess && recherche.data.length > 0 && (
        <ul className="divide-y rounded-md border bg-background text-sm">
          {recherche.data.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-muted/50"
                onClick={() => onSelection(d)}
              >
                <span>
                  <span className="font-medium">{d.tier_nom}</span>{' '}
                  <span className="font-mono text-xs text-muted-foreground">{d.application_number}</span>
                  <br />
                  <span className="text-xs text-muted-foreground">
                    {fmt(G.resultatLigne, {
                      montant: formatFcfa(d.montant_decide),
                      produit: d.product_name,
                    })}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Fiche({
  dossier,
  onChangerRecherche,
}: {
  dossier: DossierDecaissable
  onChangerRecherche: () => void
}) {
  const [confirmation, setConfirmation] = useState(false)
  const [succes, setSucces] = useState<DemandeCreditDecaissee | null>(null)

  const apercu = useQuery({
    queryKey: ['credit', 'apercu-decaissement-guichet', dossier.id],
    queryFn: () => lireApercuDecaissementGuichet(dossier.id),
  })

  const mutation = useMutation({
    mutationFn: () => decaisserDemandeCredit(dossier.id, { mode: 'caisse' }),
    onSuccess: (res) => {
      setSucces(res)
      setConfirmation(false)
    },
  })

  if (succes) {
    return (
      <Alert role="status">
        <AlertDescription className="space-y-2">
          <p>
            {fmt(G.succes, {
              montant: formatFcfa(dossier.montant_decide),
              dossier: dossier.application_number,
            })}
          </p>
          <p>{fmt(G.succesEcheances, { n: String(succes.nb_echeances) })}</p>
          <Button size="sm" variant="ghost" onClick={onChangerRecherche}>
            {G.autreOperation}
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <section className="space-y-4 rounded-md border p-4">
      <div className="flex items-center gap-3">
        <Banknote className="mt-1 size-6 text-muted-foreground" aria-hidden />
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{G.tiers}</p>
          <p className="text-lg font-bold">{dossier.tier_nom}</p>
          <p className="font-mono text-sm text-muted-foreground">
            {G.dossier} {dossier.application_number} · {dossier.product_name}
          </p>
        </div>
      </div>

      {/* Le montant : AFFICHÉ, jamais saisissable — c'est celui accordé par le comité. */}
      <div className="rounded-md bg-muted/50 p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{G.montantADecaisser}</p>
        <p className="text-2xl font-bold tabular-nums">{formatFcfa(dossier.montant_decide)}</p>
        <p className="text-xs text-muted-foreground">
          {fmt(G.duree, { n: String(dossier.duree_echeances) })}
        </p>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">{G.apercuTitre}</h2>
        {apercu.isPending && <p className="text-sm text-muted-foreground">{G.apercuChargement}</p>}
        {apercu.isError && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{messageRefusCredit(apercu.error, G.apercuErreur)}</AlertDescription>
          </Alert>
        )}
        {apercu.isSuccess && <TableEcheances lignes={apercu.data} avecStatut={false} avecTotaux />}
      </div>

      {!confirmation ? (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setConfirmation(true)}>
            {G.decaisser}
          </Button>
          <Button size="sm" variant="ghost" onClick={onChangerRecherche}>
            {G.changerRecherche}
          </Button>
        </div>
      ) : (
        <div className="space-y-3 rounded-md border border-brand/40 bg-brand-subtle/40 p-3">
          <p className="text-sm">
            {fmt(G.confirmerDecaissement, {
              montant: formatFcfa(dossier.montant_decide),
              dossier: dossier.application_number,
            })}
            <br />
            <span className="font-semibold">{fmt(G.confirmerQuestion, { nom: dossier.tier_nom })}</span>
          </p>
          {mutation.isError && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{messageRefusCredit(mutation.error, G.echec)}</AlertDescription>
            </Alert>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? G.enCours : G.confirmer}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmation(false)}
              disabled={mutation.isPending}
            >
              {G.annuler}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
