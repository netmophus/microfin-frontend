import { useMutation } from '@tanstack/react-query'
import { CalendarClock, Coins } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  formatFcfa,
  formatTaux,
  messageRefus,
  previsualiserInterets,
  verserInterets,
  type ApercuInterets,
  type RapportInterets,
} from '@/features/epargne/api'
import { LIBELLES } from '@/libelles/fr'

const I = LIBELLES.interets

function fmt(gabarit: string, valeurs: Record<string, string>): string {
  return gabarit.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '')
}

/** « 2026-01-01 » -> « 01/01/2026 », sans passer par Date (pas de décalage de fuseau). */
function jjmmaaaa(iso: string): string {
  return iso.split('-').reverse().join('/')
}

/**
 * Versement des intérêts — réservé à la DIRECTION (acte d'institution). La règle du module : on
 * PRÉVISUALISE avant de verser. L'écran calcule et MONTRE (total + détail par compte : taux,
 * méthode, montant) AVANT tout versement, pour qu'un responsable financier vérifie « ça a l'air
 * juste » avant de créer de l'argent sur des milliers de comptes. La confirmation est renforcée.
 * Si la période est déjà versée (anti-double), on le DIT — pas d'échec silencieux.
 */
export function PageVersementInterets() {
  const [periode, setPeriode] = useState('')
  const [debut, setDebut] = useState('')
  const [fin, setFin] = useState('')
  const [apercu, setApercu] = useState<ApercuInterets | null>(null)
  const [confirmation, setConfirmation] = useState(false)
  const [rapport, setRapport] = useState<RapportInterets | null>(null)
  const [saisieErreur, setSaisieErreur] = useState<string | null>(null)

  const demande = { periode: periode.trim(), debut, fin }
  const complet = periode.trim() !== '' && debut !== '' && fin !== ''

  const previsualisation = useMutation({
    mutationFn: () => previsualiserInterets(demande),
    onSuccess: (data) => {
      setApercu(data)
      setConfirmation(false)
      setRapport(null)
    },
  })

  // Le clic ne reste JAMAIS sans effet : champs incomplets -> message, sinon on lance l'aperçu.
  const soumettre = () => {
    if (!complet) {
      setSaisieErreur(I.saisieIncomplete)
      return
    }
    setSaisieErreur(null)
    previsualisation.mutate()
  }

  const versement = useMutation({
    mutationFn: () => verserInterets(demande),
    onSuccess: (data) => {
      setRapport(data)
      setConfirmation(false)
      setApercu(null)
    },
  })

  const recommencer = () => {
    setApercu(null)
    setRapport(null)
    setConfirmation(false)
    setSaisieErreur(null)
    previsualisation.reset()
    versement.reset()
  }

  // Prévisualisation faite mais rien à verser. On ne reste jamais muet : on DIT la raison.
  const rienAVerser = apercu !== null && apercu.comptes_a_crediter === 0
  const dejaVerse = rienAVerser && apercu.deja_traites > 0
  const raisonRien = (a: ApercuInterets): string => {
    if (a.comptes_actifs === 0) return I.raisonAucunCompte
    if (a.comptes_taux_zero >= a.comptes_actifs) return I.raisonTauxZero // tous à taux 0
    return I.raisonSoldes // ils ont un taux, mais aucun intérêt dû (soldes / mouvements)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Coins className="size-5 text-muted-foreground" />
          {I.titre}
        </h1>
        <p className="text-sm text-muted-foreground">{I.intro}</p>
      </header>

      {/* Étape 1 — la période. */}
      <form
        className="space-y-3 rounded-md border p-4"
        onSubmit={(e) => {
          e.preventDefault()
          soumettre()
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="periode">{I.periodeLabel}</Label>
          <Input
            id="periode"
            value={periode}
            onChange={(e) => setPeriode(e.target.value)}
            placeholder={I.periodePlaceholder}
          />
          <p className="text-xs text-muted-foreground">{I.periodeAide}</p>
        </div>
        <div className="flex gap-3">
          <div className="flex-1 space-y-1">
            <Label htmlFor="debut">{I.debutLabel}</Label>
            <Input id="debut" type="date" value={debut} onChange={(e) => setDebut(e.target.value)} />
          </div>
          <div className="flex-1 space-y-1">
            <Label htmlFor="fin">{I.finLabel}</Label>
            <Input id="fin" type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
          </div>
        </div>
        <Button type="submit" disabled={previsualisation.isPending}>
          <CalendarClock className="mr-1 size-4" />
          {previsualisation.isPending ? I.previsualisationEnCours : I.previsualiser}
        </Button>
        {/* Champs incomplets : on le DIT, le clic n'est jamais silencieux. */}
        {saisieErreur && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{saisieErreur}</AlertDescription>
          </Alert>
        )}
        {previsualisation.isError && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{messageRefus(previsualisation.error, I.echec)}</AlertDescription>
          </Alert>
        )}
      </form>

      {/* Étape 2 — la prévisualisation (rien n'est encore versé). Si rien à verser, on DIT
          pourquoi : déjà versé (avec la date), taux 0, aucun compte, ou soldes insuffisants. */}
      {apercu && rienAVerser && (
        <Alert role="status">
          <AlertDescription className="space-y-2">
            {dejaVerse ? (
              <>
                <p className="font-medium">{I.dejaVerseTitre}</p>
                <p>
                  {fmt(I.dejaVerseDetail, {
                    date: apercu.deja_verse_le
                      ? new Date(apercu.deja_verse_le).toLocaleDateString('fr-FR')
                      : '—',
                  })}
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">{I.apercuAucunTitre}</p>
                <p>{raisonRien(apercu)}</p>
              </>
            )}
            <Button size="sm" variant="ghost" onClick={recommencer}>
              {I.recommencer}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {apercu && apercu.comptes_a_crediter > 0 && !confirmation && (
        <section className="space-y-3 rounded-md border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{I.apercuTitre}</p>
          {/* Le résumé : X comptes, total Y F. */}
          <p className="text-lg font-semibold">
            {fmt(I.apercuResume, {
              comptes: String(apercu.comptes_a_crediter),
              total: formatFcfa(apercu.total),
            })}
          </p>
          <p className="text-sm text-muted-foreground">
            {fmt(I.apercuPeriode, {
              debut: jjmmaaaa(apercu.debut),
              fin: jjmmaaaa(apercu.fin),
              jours: String(apercu.jours),
            })}
          </p>

          {/* Provisoire : le barème n'est pas validé — on le dit fort. */}
          <div
            role="note"
            className="rounded-md border border-warning/50 bg-warning-subtle/40 px-3 py-2 text-sm text-foreground"
          >
            {I.provisoireBanniere}
          </div>

          {/* Anti-double partiel : quelques comptes de la période sont déjà versés. */}
          {apercu.deja_traites > 0 && (
            <p className="text-sm text-muted-foreground">
              {fmt(I.dejaTraites, { n: String(apercu.deja_traites) })}
            </p>
          )}

          {/* Le DÉTAIL par compte : vérifier « ça a l'air juste » (taux visible, pas qu'un total). */}
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {I.detailTitre}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-1 pr-2 font-medium">{I.colCompte}</th>
                    <th className="py-1 pr-2 font-medium">{I.colProduit}</th>
                    <th className="py-1 pr-2 font-medium">{I.colTaux}</th>
                    <th className="py-1 pr-2 font-medium">{I.colMethode}</th>
                    <th className="py-1 pr-2 text-right font-medium">{I.colBase}</th>
                    <th className="py-1 text-right font-medium">{I.colMontant}</th>
                  </tr>
                </thead>
                <tbody>
                  {apercu.echantillon.map((l) => (
                    <tr key={l.account_number} className="border-b last:border-0">
                      <td className="py-1 pr-2 font-mono text-xs">{l.account_number}</td>
                      <td className="py-1 pr-2">{l.produit}</td>
                      <td className="py-1 pr-2 tabular-nums">{formatTaux(l.taux_bp)}</td>
                      <td className="py-1 pr-2">{I.methodes[l.methode] ?? l.methode}</td>
                      <td className="py-1 pr-2 text-right tabular-nums">{formatFcfa(l.base_solde)}</td>
                      <td className="py-1 text-right font-semibold tabular-nums">
                        {formatFcfa(l.montant)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => setConfirmation(true)}>{I.confirmer}</Button>
            <Button variant="ghost" onClick={recommencer}>
              {I.annuler}
            </Button>
          </div>
        </section>
      )}

      {/* Étape 3 — confirmation RENFORCÉE : on va créer de l'argent. */}
      {apercu && confirmation && (
        <section className="space-y-3 rounded-md border border-warning/50 bg-warning-subtle/40 p-4">
          <p className="font-medium">{I.confirmerTitre}</p>
          <p className="text-sm">
            {fmt(I.confirmerAvert, {
              comptes: String(apercu.comptes_a_crediter),
              total: formatFcfa(apercu.total),
            })}
          </p>
          {versement.isError && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{messageRefus(versement.error, I.echec)}</AlertDescription>
            </Alert>
          )}
          <div className="flex gap-2">
            <Button onClick={() => versement.mutate()} disabled={versement.isPending}>
              {versement.isPending ? I.versementEnCours : I.confirmer}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmation(false)} disabled={versement.isPending}>
              {I.annuler}
            </Button>
          </div>
        </section>
      )}

      {/* Étape 4 — le résultat. */}
      {rapport && (
        <Alert role="status">
          <AlertDescription className="space-y-2">
            <p className="font-medium">{I.succesTitre}</p>
            <p>
              {rapport.credites > 0
                ? fmt(I.succesDetail, {
                    credites: String(rapport.credites),
                    total: formatFcfa(rapport.total),
                  })
                : I.succesRienAVerser}
            </p>
            <Button size="sm" variant="ghost" onClick={recommencer}>
              {I.recommencer}
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
