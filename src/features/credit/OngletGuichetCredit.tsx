import { useMutation } from '@tanstack/react-query'
import { HandCoins, Search } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  messageRefusCredit,
  rechercherRemboursements,
  rembourserDemandeCredit,
  type DossierRemboursable,
  type RemboursementRecu,
} from '@/features/credit/api'
import { formatFcfa } from '@/features/epargne/api'
import { LIBELLES } from '@/libelles/fr'

const G = LIBELLES.guichetCredit

function fmt(gabarit: string, valeurs: Record<string, string>): string {
  return gabarit.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '')
}

/**
 * Onglet « Crédit » du guichet (CR6d) — encaissement d'une échéance, une à la fois. Recherche
 * par numéro de dossier, numéro de tiers OU nom (un seul champ, le serveur fait le OU). Un
 * dossier déjà soldé apparaît TEL QUEL dans les résultats — jamais un clic qui échouerait.
 *
 * DIVERGENCE assumée avec les onglets Épargne/Parts : le montant n'est jamais saisi, seulement
 * affiché — TOUJOURS le solde restant (`solde_du`, CR5b) en entier. Le service accepte un
 * versement partiel (le prélèvement automatique, CR5d à venir, l'utilise pour une situation
 * SUBIE — solde insuffisant), mais ce n'est délibérément PAS offert au guichet : ouvrir cette
 * porte introduirait une négociation informelle caissier/client jamais validée comme politique
 * de crédit (décision explicite, pas une limite technique).
 */
export function OngletGuichetCredit() {
  const [dossier, setDossier] = useState<DossierRemboursable | null>(null)

  return (
    <div className="mx-auto max-w-xl space-y-5 p-4">
      <p className="text-sm text-muted-foreground">{G.intro}</p>

      {!dossier ? (
        <Recherche onSelection={setDossier} />
      ) : (
        <FicheGuichet dossier={dossier} onChangerRecherche={() => setDossier(null)} />
      )}
    </div>
  )
}

function Recherche({ onSelection }: { onSelection: (d: DossierRemboursable) => void }) {
  const [q, setQ] = useState('')
  const recherche = useMutation({
    mutationFn: () => rechercherRemboursements(q.trim()),
  })

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (q.trim()) recherche.mutate()
      }}
    >
      <Label htmlFor="recherche-credit-guichet">{G.rechercherLabel}</Label>
      <div className="flex gap-2">
        <Input
          id="recherche-credit-guichet"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={G.rechercherPlaceholder}
        />
        <Button type="submit" disabled={!q.trim() || recherche.isPending}>
          <Search className="mr-1 size-4" />
          {recherche.isPending ? G.rechercheEnCours : G.chercher}
        </Button>
      </div>

      {recherche.isSuccess && recherche.data.length === 0 && (
        <Alert role="alert">
          <AlertDescription>{G.aucunResultat}</AlertDescription>
        </Alert>
      )}

      {recherche.isSuccess && recherche.data.length > 0 && (
        <ul className="divide-y rounded-md border bg-background text-sm">
          {recherche.data.map((d) => {
            const echeance = d.prochaine_echeance
            return (
              <li key={d.id}>
                {echeance ? (
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-muted/50"
                    onClick={() => onSelection(d)}
                  >
                    <span>
                      <span className="font-medium">{d.tier_nom}</span>{' '}
                      <span className="font-mono text-xs text-muted-foreground">
                        {d.application_number}
                      </span>
                      <br />
                      <span className="text-xs text-muted-foreground">
                        {fmt(G.echeanceDue, {
                          numero: String(echeance.numero),
                          montant: formatFcfa(echeance.solde_du),
                          date: new Date(echeance.due_date).toLocaleDateString('fr-FR'),
                        })}
                      </span>
                    </span>
                  </button>
                ) : (
                  <div className="flex w-full items-center justify-between gap-3 p-3 text-muted-foreground">
                    <span>
                      <span className="font-medium">{d.tier_nom}</span>{' '}
                      <span className="font-mono text-xs">{d.application_number}</span>
                    </span>
                    <span className="text-xs italic">{G.dejaSolde}</span>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </form>
  )
}

function FicheGuichet({
  dossier,
  onChangerRecherche,
}: {
  dossier: DossierRemboursable
  onChangerRecherche: () => void
}) {
  const echeance = dossier.prochaine_echeance
  // Garde défensive : la recherche ne rend cliquable qu'un dossier avec une échéance due. Si
  // rien n'est parvenu ici (ne devrait pas arriver), on le dit plutôt que de planter.
  if (!echeance) {
    return (
      <section className="space-y-3 rounded-md border p-4">
        <Alert role="note">
          <AlertDescription>{G.dejaSolde}</AlertDescription>
        </Alert>
        <Button size="sm" variant="ghost" onClick={onChangerRecherche}>
          {G.changerRecherche}
        </Button>
      </section>
    )
  }

  return (
    <section className="space-y-4 rounded-md border p-4">
      {/* Le tiers, et surtout son NOM, en évidence — vérification humaine avant l'encaissement. */}
      <div className="flex items-center gap-3">
        <HandCoins className="mt-1 size-6 text-muted-foreground" />
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{G.tiers}</p>
          <p className="text-lg font-bold">{dossier.tier_nom}</p>
          <p className="font-mono text-sm text-muted-foreground">
            {G.dossier} {dossier.application_number} · {dossier.product_name}
          </p>
        </div>
      </div>

      {/* Le montant : AFFICHÉ, jamais saisissable — le serveur exige l'exact (le SOLDE, pas le
          total d'origine si un versement partiel a déjà eu lieu, CR5b). */}
      <div className="rounded-md bg-muted/50 p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {G.montantAregler}
        </p>
        <p className="text-2xl font-bold tabular-nums">{formatFcfa(echeance.solde_du)}</p>
        <p className="text-xs text-muted-foreground">
          {G.echeanceLabel} #{echeance.numero} · {G.capitalLabel} {formatFcfa(echeance.capital)} ·{' '}
          {G.interetsLabel} {formatFcfa(echeance.interets)}
        </p>
        {echeance.montant_paye > 0 && (
          <p className="text-xs text-muted-foreground">
            {fmt(G.dejaVerse, { montant: formatFcfa(echeance.montant_paye) })}
          </p>
        )}
      </div>

      <Operations dossier={dossier} echeance={echeance} onChangerRecherche={onChangerRecherche} />
    </section>
  )
}

function Operations({
  dossier,
  echeance,
  onChangerRecherche,
}: {
  dossier: DossierRemboursable
  echeance: NonNullable<DossierRemboursable['prochaine_echeance']>
  onChangerRecherche: () => void
}) {
  const [confirmation, setConfirmation] = useState(false)
  const [succes, setSucces] = useState<RemboursementRecu | null>(null)

  const mutation = useMutation({
    mutationFn: () => rembourserDemandeCredit(dossier.id, echeance.solde_du),
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
            {fmt(G.succes, { numero: String(succes.numero), montant: formatFcfa(succes.montant_total) })}
          </p>
          <p>
            {succes.echeances_restantes === 0
              ? G.succesSolde
              : fmt(G.succesRestantes, { n: String(succes.echeances_restantes) })}
          </p>
          <Button size="sm" variant="ghost" onClick={onChangerRecherche}>
            {G.autreOperation}
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!confirmation) {
    return (
      <div className="flex gap-2">
        <Button size="sm" onClick={() => setConfirmation(true)}>
          {G.continuer}
        </Button>
        <Button size="sm" variant="ghost" onClick={onChangerRecherche}>
          {G.changerRecherche}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-md border border-brand/40 bg-brand-subtle/40 p-3">
      <p className="text-sm">
        {fmt(G.confirmerRemboursement, {
          montant: formatFcfa(echeance.solde_du),
          numero: String(echeance.numero),
          dossier: dossier.application_number,
        })}
        <br />
        {/* Nom RÉPÉTÉ dans la confirmation, comme les deux autres onglets du guichet. */}
        <span className="font-semibold">
          {fmt(G.confirmerQuestion, { nom: dossier.tier_nom })}
        </span>
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
  )
}
