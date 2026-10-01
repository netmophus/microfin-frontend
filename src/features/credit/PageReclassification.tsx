import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAPermission } from '@/features/auth/useProfil'
import {
  executerReclassement,
  messageRefusCredit,
  previsualiserReclassement,
  type LigneApercuReclassement,
  type LigneReclassement,
  type RapportReclassement,
} from '@/features/credit/api'
import { formatFcfa } from '@/features/epargne/api'
import { LIBELLES } from '@/libelles/fr'

const R = LIBELLES.reclassification

const CLE_APERCU = ['credit', 'delinquency-apercu']

function fmt(gabarit: string, valeurs: Record<string, string>): string {
  return gabarit.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '')
}

function libellePalier(code: string | null, libelle: string | null): string {
  return code ? `${libelle ?? code} (${code})` : R.sain
}

/**
 * Supervision PERMANENTE des crédits en souffrance (CR5c, chantier supervision lot 2) : l'état
 * se charge AU MONTAGE (useQuery), sans action requise — le même calcul pur que l'exécution
 * (`previsualiser_reclassement`, côté serveur), accessible en lecture à `credit.delinquency.read`
 * OU `credit.delinquency.executer`. Seule l'EXÉCUTION (qui pose de vraies écritures de
 * dotation/reprise sur potentiellement tout le portefeuille) reste réservée à la DIRECTION
 * (`credit.delinquency.executer`) et exige une confirmation renforcée — même règle que le
 * versement d'intérêts épargne (E5).
 */
export function PageReclassification() {
  const client = useQueryClient()
  const peutExecuter = useAPermission('credit.delinquency.executer')
  const [confirmation, setConfirmation] = useState(false)
  const [rapport, setRapport] = useState<RapportReclassement | null>(null)

  const apercuRequete = useQuery({
    queryKey: CLE_APERCU,
    queryFn: previsualiserReclassement,
    // Inutile de garder la supervision à jour en arrière-plan pendant qu'on affiche le rapport
    // d'une exécution déjà terminée — elle reprend dès qu'on revient dessus (recommencer()).
    enabled: rapport === null,
  })

  const execution = useMutation({
    mutationFn: executerReclassement,
    onSuccess: (data) => {
      setRapport(data)
      setConfirmation(false)
    },
  })

  const recommencer = () => {
    setRapport(null)
    setConfirmation(false)
    execution.reset()
    void client.invalidateQueries({ queryKey: CLE_APERCU })
  }

  const apercu = apercuRequete.data ?? null
  const rienAReclasser = apercu !== null && apercu.a_reclasser === 0

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <RefreshCw className="size-5 text-muted-foreground" />
          {R.titre}
        </h1>
        <p className="text-sm text-muted-foreground">{R.intro}</p>
        <p className="mt-1 text-xs text-warning">{R.bandeauBaremeProvisoire}</p>
      </header>

      {/* Chargement — pas besoin d'action : la supervision se charge seule au montage. Mis en
          pause (enabled: rapport === null) tant que le rapport d'une exécution est affiché. */}
      {rapport === null && apercuRequete.isPending && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {R.previsualisationEnCours}
        </p>
      )}

      {/* Erreur — ce qui a échoué, et un bouton Réessayer (4 états obligatoires). */}
      {rapport === null && apercuRequete.isError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription className="space-y-2">
            <p>{R.echecChargement}</p>
            <Button size="sm" variant="outline" onClick={() => void apercuRequete.refetch()}>
              {R.reessayer}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Vide — rien à reclasser : on le dit, on ne reste jamais muet. */}
      {rapport === null && rienAReclasser && !confirmation && (
        <Alert role="status">
          <AlertDescription>
            <p className="font-medium">{R.apercuAucun}</p>
          </AlertDescription>
        </Alert>
      )}

      {/* Données — la supervision permanente, avec quelque chose à montrer. */}
      {rapport === null && apercu && apercu.a_reclasser > 0 && !confirmation && (
        <section className="space-y-3 rounded-md border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{R.apercuTitre}</p>
          <p className="text-lg font-semibold">
            {fmt(R.apercuResume, {
              n: String(apercu.a_reclasser),
              total: String(apercu.dossiers_evalues),
            })}
          </p>

          {apercu.rattachements_manquants > 0 && (
            <div
              role="alert"
              className="rounded-md border border-danger/50 bg-danger-subtle/40 px-3 py-2 text-sm text-foreground"
            >
              {fmt(R.avertRattachements, { n: String(apercu.rattachements_manquants) })}
            </div>
          )}

          <TableauApercu lignes={apercu.lignes} />

          {/* Masquer le bouton n'est qu'une commodité d'affichage — le serveur refuse déjà
              l'exécution sans credit.delinquency.executer (403). */}
          {peutExecuter && (
            <div className="flex gap-2">
              <Button onClick={() => setConfirmation(true)}>{R.confirmer}</Button>
            </div>
          )}
        </section>
      )}

      {/* Confirmation RENFORCÉE : on va poser de vraies écritures. */}
      {apercu && confirmation && (
        <section className="space-y-3 rounded-md border border-warning/50 bg-warning-subtle/40 p-4">
          <p className="font-medium">{R.confirmerTitre}</p>
          <p className="text-sm">
            {fmt(R.confirmerAvert, {
              n: String(apercu.a_reclasser),
              total: String(apercu.dossiers_evalues),
            })}
          </p>
          {execution.isError && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{messageRefusCredit(execution.error, R.echec)}</AlertDescription>
            </Alert>
          )}
          <div className="flex gap-2">
            <Button onClick={() => execution.mutate()} disabled={execution.isPending}>
              {execution.isPending ? R.executionEnCours : R.confirmer}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setConfirmation(false)}
              disabled={execution.isPending}
            >
              {R.annuler}
            </Button>
          </div>
        </section>
      )}

      {/* Étape 4 — le résultat. */}
      {rapport && (
        <Alert role="status">
          <AlertDescription className="space-y-3">
            <p className="font-medium">{R.succesTitre}</p>
            <p>
              {rapport.reclasses > 0
                ? fmt(R.succesDetail, {
                    n: String(rapport.reclasses),
                    total: String(rapport.dossiers_evalues),
                  })
                : R.succesAucun}
            </p>
            {rapport.ignores_rattachement_manquant.length > 0 && (
              <p className="text-danger">
                {fmt(R.succesIgnores, {
                  n: String(rapport.ignores_rattachement_manquant.length),
                  liste: rapport.ignores_rattachement_manquant.join(', '),
                })}
              </p>
            )}
            {rapport.lignes.length > 0 && <TableauRapport lignes={rapport.lignes} />}
            <Button size="sm" variant="ghost" onClick={recommencer}>
              {R.recommencer}
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

function TableauApercu({ lignes }: { lignes: LigneApercuReclassement[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-1 pr-2 font-medium">{R.colDossier}</th>
            <th className="py-1 pr-2 font-medium">{R.colPalierAvant}</th>
            <th className="py-1 pr-2 font-medium">{R.colPalierApres}</th>
            <th className="py-1 pr-2 text-right font-medium">{R.colRetard}</th>
            <th className="py-1 pr-2 text-right font-medium">{R.colEncours}</th>
            <th className="py-1 pr-2 text-right font-medium">{R.colProvisionAvant}</th>
            <th className="py-1 pr-2 text-right font-medium">{R.colProvisionApres}</th>
            <th className="py-1 font-medium" aria-label="Statut" />
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => (
            <tr key={l.application_number} className="border-b last:border-0">
              <td className="py-1 pr-2 font-mono text-xs">{l.application_number}</td>
              <td className="py-1 pr-2">{libellePalier(l.tier_avant_code, l.tier_avant_libelle)}</td>
              <td className="py-1 pr-2">{libellePalier(l.tier_apres_code, l.tier_apres_libelle)}</td>
              <td className="py-1 pr-2 text-right tabular-nums">
                {fmt(R.jours, { n: String(l.jours_retard) })}
              </td>
              <td className="py-1 pr-2 text-right tabular-nums">{formatFcfa(l.encours_actuel)}</td>
              <td className="py-1 pr-2 text-right tabular-nums">{formatFcfa(l.provision_avant)}</td>
              <td className="py-1 pr-2 text-right tabular-nums">{formatFcfa(l.provision_apres)}</td>
              <td className="py-1">
                {l.rattachement_manquant && (
                  <Badge ton="danger">
                    {fmt(R.rattachementManquant, { motif: l.rattachement_manquant })}
                  </Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TableauRapport({ lignes }: { lignes: LigneReclassement[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-1 pr-2 font-medium">{R.colDossier}</th>
            <th className="py-1 pr-2 font-medium">{R.colPalierAvant}</th>
            <th className="py-1 pr-2 font-medium">{R.colPalierApres}</th>
            <th className="py-1 pr-2 text-right font-medium">{R.colRetard}</th>
            <th className="py-1 pr-2 text-right font-medium">{R.colProvisionAvant}</th>
            <th className="py-1 text-right font-medium">{R.colProvisionApres}</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => (
            <tr key={l.application_number} className="border-b last:border-0">
              <td className="py-1 pr-2 font-mono text-xs">{l.application_number}</td>
              <td className="py-1 pr-2">{libellePalier(l.tier_avant_code, l.tier_avant_libelle)}</td>
              <td className="py-1 pr-2">{libellePalier(l.tier_apres_code, l.tier_apres_libelle)}</td>
              <td className="py-1 pr-2 text-right tabular-nums">
                {fmt(R.jours, { n: String(l.jours_retard) })}
              </td>
              <td className="py-1 pr-2 text-right tabular-nums">{formatFcfa(l.provision_avant)}</td>
              <td className="py-1 text-right tabular-nums">{formatFcfa(l.provision_apres)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
