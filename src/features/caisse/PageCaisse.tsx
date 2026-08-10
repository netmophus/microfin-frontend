import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Wallet } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  chargerSessionCourante,
  fermerSession,
  messageRefusCaisse,
  ouvrirSession,
  type SessionCaisse,
} from '@/features/caisse/api'
import { formatFcfa } from '@/features/epargne/api'
import { LIBELLES } from '@/libelles/fr'

const C = LIBELLES.caisse
const CLE_REQUETE = ['caisse', 'session-courante'] as const

function fmt(gabarit: string, valeurs: Record<string, string>): string {
  return gabarit.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '')
}

/** Chaîne saisie -> entier non négatif, ou NaN si vide/non renseignée. Les caractères non
 * numériques sont retirés au fil de la frappe (comme le guichet épargne) — la validation
 * porte seulement sur « rien n'a été saisi », vérifiée à la sortie du champ. */
function versEntier(valeur: string): number {
  const nettoye = valeur.replace(/\D/g, '')
  return nettoye === '' ? Number.NaN : Number.parseInt(nettoye, 10)
}

function dateHeure(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** L'écart n'est JAMAIS porté par la seule couleur : le sens (excédent/manquant/nul) est
 * toujours écrit en toutes lettres, avec le montant. */
function texteEcart(ecart: number): string {
  if (ecart === 0) return C.ecartNul
  if (ecart > 0) return fmt(C.ecartExcedent, { montant: formatFcfa(ecart) })
  return fmt(C.ecartManquant, { montant: formatFcfa(Math.abs(ecart)) })
}

/**
 * Session de caisse (CA1/CA4) — ouverture, solde théorique EN DIRECT, fermeture. Ne bloque
 * JAMAIS sur la taille de l'écart (CA2, pas encore construite) : l'écart est montré, en toutes
 * lettres, avant confirmation — jamais découvert après coup.
 */
export function PageCaisse() {
  const queryClient = useQueryClient()
  const requete = useQuery({ queryKey: CLE_REQUETE, queryFn: chargerSessionCourante })

  const [fondsInitial, setFondsInitial] = useState('')
  const [fondsInitialErreur, setFondsInitialErreur] = useState<string | null>(null)

  const [montantReel, setMontantReel] = useState('')
  const [montantReelErreur, setMontantReelErreur] = useState<string | null>(null)
  const [confirmationFermeture, setConfirmationFermeture] = useState(false)
  const [dernierRecap, setDernierRecap] = useState<SessionCaisse | null>(null)

  const fondsInitialNum = versEntier(fondsInitial)
  const montantReelNum = versEntier(montantReel)

  const ouverture = useMutation({
    mutationFn: () => ouvrirSession(fondsInitialNum),
    onSuccess: () => {
      setFondsInitial('')
      setFondsInitialErreur(null)
      setDernierRecap(null)
      queryClient.invalidateQueries({ queryKey: CLE_REQUETE })
    },
  })

  const fermeture = useMutation({
    mutationFn: (sessionId: string) => fermerSession(sessionId, montantReelNum),
    onSuccess: (data) => {
      setDernierRecap(data)
      setMontantReel('')
      setMontantReelErreur(null)
      setConfirmationFermeture(false)
      queryClient.invalidateQueries({ queryKey: CLE_REQUETE })
    },
  })

  const soumettreOuverture = () => {
    if (Number.isNaN(fondsInitialNum)) {
      setFondsInitialErreur(C.fondsInitialErreur)
      return
    }
    setFondsInitialErreur(null)
    ouverture.mutate()
  }

  const demanderFermeture = () => {
    if (Number.isNaN(montantReelNum)) {
      setMontantReelErreur(C.montantReelErreur)
      return
    }
    setMontantReelErreur(null)
    setConfirmationFermeture(true)
  }

  const annulerFermeture = () => setConfirmationFermeture(false)

  // Une CONSTANTE locale, pas `requete.data` répété : TypeScript ne garde le narrowing non-nul
  // d'une propriété que jusqu'à la prochaine fermeture d'événement (onClick), jamais au-delà —
  // une constante si, ce qui évite un `!` d'assertion à chaque usage plus bas.
  const session = requete.data ?? null

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Wallet className="size-5 text-muted-foreground" />
          {C.titre}
        </h1>
        <p className="text-sm text-muted-foreground">{C.intro}</p>
      </header>

      {requete.isPending ? (
        <p className="py-4 text-sm text-muted-foreground">{C.chargement}</p>
      ) : requete.isError ? (
        <div className="space-y-3">
          <Alert variant="destructive" role="alert">
            <AlertDescription>{C.erreur}</AlertDescription>
          </Alert>
          <Button variant="outline" onClick={() => requete.refetch()}>
            {C.reessayer}
          </Button>
        </div>
      ) : dernierRecap && !session ? (
        <Alert role="status">
          <AlertDescription className="space-y-2">
            <p className="font-medium">{C.fermeeTitre}</p>
            {dernierRecap.closed_at && (
              <p className="text-sm text-muted-foreground">
                {fmt(C.fermeeLe, { date: dateHeure(dernierRecap.closed_at) })}
              </p>
            )}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">{C.soldeTheoriqueLabel}</dt>
              <dd className="text-right tabular-nums">
                {formatFcfa(dernierRecap.solde_theorique_cloture ?? 0)}
              </dd>
              <dt className="text-muted-foreground">{C.montantReelLabel}</dt>
              <dd className="text-right tabular-nums">
                {formatFcfa(dernierRecap.montant_reel_cloture ?? 0)}
              </dd>
              <dt className="text-muted-foreground">{C.ecartLabel}</dt>
              <dd className="text-right tabular-nums">{texteEcart(dernierRecap.ecart ?? 0)}</dd>
            </dl>
            <Button size="sm" variant="ghost" onClick={() => setDernierRecap(null)}>
              {C.nouvelleSession}
            </Button>
          </AlertDescription>
        </Alert>
      ) : !session ? (
        // Aucune session ouverte : le formulaire d'ouverture.
        <form
          className="space-y-3 rounded-md border p-4"
          onSubmit={(e) => {
            e.preventDefault()
            soumettreOuverture()
          }}
        >
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{C.ouvertureTitre}</p>
          <div className="space-y-1">
            <Label htmlFor="fonds-initial">{C.fondsInitialLabel}</Label>
            <Input
              id="fonds-initial"
              inputMode="numeric"
              value={fondsInitial}
              onChange={(e) => setFondsInitial(e.target.value)}
              onBlur={() =>
                setFondsInitialErreur(Number.isNaN(versEntier(fondsInitial)) ? C.fondsInitialErreur : null)
              }
              aria-invalid={fondsInitialErreur !== null}
            />
            <p className="text-xs text-muted-foreground">{C.fondsInitialAide}</p>
            {fondsInitialErreur && <p className="text-xs text-danger">{fondsInitialErreur}</p>}
          </div>
          <Button type="submit" disabled={ouverture.isPending}>
            {ouverture.isPending ? C.ouvertureEnCours : C.ouvrir}
          </Button>
          {ouverture.isError && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{messageRefusCaisse(ouverture.error, C.ouvertureEchec)}</AlertDescription>
            </Alert>
          )}
        </form>
      ) : (
        // Une session est ouverte (session, pas requete.data : une constante locale reste
        // narrowée non-nulle dans les fermetures d'événements ci-dessous, une propriété non).
        <div className="space-y-5">
          <section className="space-y-3 rounded-md border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {fmt(C.ouverteDepuis, { date: dateHeure(session.opened_at) })}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {C.compteLabel} : <span className="font-mono">{session.compte_caisse_number}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {C.fondsInitialCourant} : {formatFcfa(session.fonds_initial)}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => requete.refetch()}
                disabled={requete.isFetching}
              >
                <RefreshCw className="mr-1 size-4" />
                {requete.isFetching ? C.actualisationEnCours : C.actualiser}
              </Button>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{C.soldeTheoriqueLabel}</p>
              <p className="text-2xl font-semibold tabular-nums">
                {formatFcfa(session.solde_theorique_actuel ?? 0)}
              </p>
            </div>
          </section>

          {!confirmationFermeture ? (
            <section className="space-y-3 rounded-md border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{C.fermetureTitre}</p>
              <div className="space-y-1">
                <Label htmlFor="montant-reel">{C.montantReelLabel}</Label>
                <Input
                  id="montant-reel"
                  inputMode="numeric"
                  value={montantReel}
                  onChange={(e) => setMontantReel(e.target.value)}
                  onBlur={() =>
                    setMontantReelErreur(
                      Number.isNaN(versEntier(montantReel)) ? C.montantReelErreur : null,
                    )
                  }
                  aria-invalid={montantReelErreur !== null}
                />
                {montantReelErreur && <p className="text-xs text-danger">{montantReelErreur}</p>}
                {!Number.isNaN(montantReelNum) && (
                  <p className="text-sm text-muted-foreground">
                    {texteEcart(montantReelNum - (session.solde_theorique_actuel ?? 0))}
                  </p>
                )}
              </div>
              <Button variant="outline" onClick={demanderFermeture}>
                {C.fermerCaisse}
              </Button>
            </section>
          ) : (
            // Confirmation RENFORCÉE : fige les montants, ne se corrige plus ensuite.
            <section className="space-y-3 rounded-md border border-warning/50 bg-warning-subtle/40 p-4">
              <p className="font-medium">{C.confirmerTitre}</p>
              <p className="text-sm">
                {fmt(C.confirmerAvert, {
                  theorique: formatFcfa(session.solde_theorique_actuel ?? 0),
                  compte: formatFcfa(montantReelNum),
                  ecart: texteEcart(montantReelNum - (session.solde_theorique_actuel ?? 0)),
                })}
              </p>
              {fermeture.isError && (
                <Alert variant="destructive" role="alert">
                  <AlertDescription>{messageRefusCaisse(fermeture.error, C.fermetureEchec)}</AlertDescription>
                </Alert>
              )}
              <div className="flex gap-2">
                <Button onClick={() => fermeture.mutate(session.id)} disabled={fermeture.isPending}>
                  {fermeture.isPending ? C.fermetureEnCours : C.confirmer}
                </Button>
                <Button variant="ghost" onClick={annulerFermeture} disabled={fermeture.isPending}>
                  {C.annuler}
                </Button>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
