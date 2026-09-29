import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'

import { SelecteurCompte } from '@/components/comptabilite/selecteur-compte'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAPermission } from '@/features/auth/useProfil'
import {
  listerNiveauxCaisse,
  listerRattachementsAgences,
  messageRefusCompte,
  modifierCompteCaisse,
  rattacherNiveauCaisse,
  type AgenceRattachement,
  type CompteRattachement,
  type NiveauCaisseCode,
} from '@/features/comptabilite/api'
import { LIBELLES } from '@/libelles/fr'

const P = LIBELLES.rattachementsCaisse

const NIVEAUX: readonly NiveauCaisseCode[] = ['coffre', 'principale']

function fmt(gabarit: string, valeurs: Record<string, string>): string {
  return gabarit.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '')
}

function libelleNiveau(niveau: NiveauCaisseCode): string {
  return niveau === 'coffre' ? P.niveauCoffre : P.niveauPrincipale
}

/**
 * Rattachement du compte de caisse par agence (Bloc 5) — le rattachement historique
 * (`Agency.compte_caisse_id`) EN PLUS des niveaux « coffre » et « principale » (chantier
 * coffre-fort/caisses, sous-chantier 1 Bloc 2 : `caisse.niveaux_caisse`). Même patron pour les
 * trois (une ligne à la fois en édition). Le niveau SECONDAIRE n'est délibérément PAS ici : il
 * se rattache par poste, voir la note sous le tableau.
 */
export function PageRattachementsCaisse() {
  const client = useQueryClient()
  const [enEdition, setEnEdition] = useState<string | null>(null)
  const peutGerer = useAPermission('compta.plan.manage')

  const agences = useQuery({
    queryKey: ['comptabilite', 'rattachements-caisse'],
    queryFn: listerRattachementsAgences,
  })
  const niveaux = useQuery({
    queryKey: ['comptabilite', 'niveaux-caisse'],
    queryFn: listerNiveauxCaisse,
  })

  const rafraichir = () => {
    setEnEdition(null)
    void client.invalidateQueries({ queryKey: ['comptabilite', 'rattachements-caisse'] })
    void client.invalidateQueries({ queryKey: ['comptabilite', 'niveaux-caisse'] })
  }

  const chargement = agences.isPending || niveaux.isPending
  const echec = agences.isError || niveaux.isError
  const interdit =
    (agences.error instanceof AxiosError && agences.error.response?.status === 403) ||
    (niveaux.error instanceof AxiosError && niveaux.error.response?.status === 403)

  const niveauxParAgence = new Map((niveaux.data ?? []).map((a) => [a.agency_id, a.niveaux]))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{P.titre}</h1>
        <p className="text-sm text-muted-foreground">{P.sousTitre}</p>
      </div>

      <Alert>
        <AlertDescription>{P.avertissement}</AlertDescription>
      </Alert>

      {chargement ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{P.chargement}</p>
      ) : echec ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{interdit ? P.interdit : P.erreur}</AlertDescription>
        </Alert>
      ) : agences.data.length === 0 ? (
        <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
          {P.listeVide}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{P.colonneAgence}</th>
                  <th className="px-3 py-2 text-left font-medium">{P.colonneCaisse}</th>
                  {peutGerer && <th className="px-3 py-2" />}
                </tr>
              </thead>
              <tbody>
                {agences.data.map((agence) => (
                  <Fragment key={agence.id}>
                    {enEdition === agence.id ? (
                      <LigneEdition
                        agence={agence}
                        onFini={rafraichir}
                        onAnnuler={() => setEnEdition(null)}
                      />
                    ) : (
                      <LigneLecture
                        agence={agence}
                        peutGerer={peutGerer}
                        onModifier={() => setEnEdition(agence.id)}
                      />
                    )}
                    {NIVEAUX.map((niveauCode) => {
                      const cle = `${agence.id}:${niveauCode}`
                      const compteActuel =
                        niveauxParAgence.get(agence.id)?.find((n) => n.niveau === niveauCode)
                          ?.compte_caisse ?? null
                      return enEdition === cle ? (
                        <LigneNiveauEdition
                          key={cle}
                          agenceId={agence.id}
                          niveau={niveauCode}
                          compteActuel={compteActuel}
                          onFini={rafraichir}
                          onAnnuler={() => setEnEdition(null)}
                        />
                      ) : (
                        <LigneNiveauLecture
                          key={cle}
                          niveau={niveauCode}
                          compte={compteActuel}
                          peutGerer={peutGerer}
                          onModifier={() => setEnEdition(cle)}
                        />
                      )
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            {P.niveauSecondaireNote}{' '}
            <Link to="/caisse/postes" className="underline underline-offset-2 hover:text-foreground">
              {P.niveauSecondaireLien}
            </Link>
          </p>
        </>
      )}
    </div>
  )
}

function LigneLecture({
  agence,
  peutGerer,
  onModifier,
}: {
  agence: AgenceRattachement
  peutGerer: boolean
  onModifier: () => void
}) {
  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-2">
        <span className="font-medium">{agence.name}</span>
        <span className="ml-2 font-mono text-xs text-muted-foreground">{agence.code}</span>
      </td>
      <td className="px-3 py-2">
        {agence.compte_caisse ? (
          <span className="font-mono text-xs">
            {agence.compte_caisse.account_number} — {agence.compte_caisse.name}
          </span>
        ) : (
          <span className="text-muted-foreground">{P.aucun}</span>
        )}
        {agence.postes_divergents.length > 0 && (
          <p role="note" className="mt-1 text-xs text-warning">
            {fmt(P.divergence, {
              postes: agence.postes_divergents
                .map((poste) =>
                  poste.compte_caisse
                    ? `« ${poste.libelle} » (${poste.compte_caisse.account_number})`
                    : `« ${poste.libelle} » (non rattaché)`,
                )
                .join(', '),
            })}
          </p>
        )}
      </td>
      {peutGerer && (
        <td className="px-3 py-2 text-right">
          <Button size="sm" variant="outline" onClick={onModifier}>
            {P.modifier}
          </Button>
        </td>
      )}
    </tr>
  )
}

function LigneEdition({
  agence,
  onFini,
  onAnnuler,
}: {
  agence: AgenceRattachement
  onFini: () => void
  onAnnuler: () => void
}) {
  const [compteCaisse, setCompteCaisse] = useState(agence.compte_caisse?.account_number ?? null)
  const [motif, setMotif] = useState('')

  const mutation = useMutation({
    mutationFn: () => modifierCompteCaisse(agence.id, compteCaisse, motif.trim()),
    onSuccess: onFini,
  })

  const motifValide = motif.trim().length >= 3
  const idBase = `rc-${agence.id}`

  return (
    <tr className="border-b bg-brand-subtle/30 last:border-0">
      <td className="px-3 py-3 align-top">
        <span className="font-medium">{agence.name}</span>
        <span className="block font-mono text-xs text-muted-foreground">{agence.code}</span>
      </td>
      <td className="px-3 py-3 align-top">
        <SelecteurCompte
          id={`${idBase}-caisse`}
          label={P.colonneCaisse}
          filtre="saisie"
          valeur={compteCaisse}
          onChange={setCompteCaisse}
          libelleInitial={
            agence.compte_caisse
              ? `${agence.compte_caisse.account_number} — ${agence.compte_caisse.name}`
              : null
          }
        />
      </td>
      <td className="px-3 py-3 align-top">
        <div className="space-y-2">
          <div className="space-y-1">
            <Label htmlFor={`${idBase}-motif`}>{P.motif}</Label>
            <Input
              id={`${idBase}-motif`}
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder={P.motifPlaceholder}
            />
          </div>
          {mutation.isError && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{messageRefusCompte(mutation.error, P.echec)}</AlertDescription>
            </Alert>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!motifValide || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? P.enregistrementEnCours : P.enregistrer}
            </Button>
            <Button size="sm" variant="ghost" onClick={onAnnuler}>
              {P.annuler}
            </Button>
          </div>
        </div>
      </td>
    </tr>
  )
}

function LigneNiveauLecture({
  niveau,
  compte,
  peutGerer,
  onModifier,
}: {
  niveau: NiveauCaisseCode
  compte: CompteRattachement | null
  peutGerer: boolean
  onModifier: () => void
}) {
  return (
    <tr className="border-b bg-muted/20 last:border-0">
      <td className="px-3 py-2 pl-6 text-muted-foreground">↳ {libelleNiveau(niveau)}</td>
      <td className="px-3 py-2">
        {compte ? (
          <span className="font-mono text-xs">
            {compte.account_number} — {compte.name}
          </span>
        ) : (
          <span className="text-muted-foreground">{P.niveauNonParametre}</span>
        )}
      </td>
      {peutGerer && (
        <td className="px-3 py-2 text-right">
          <Button size="sm" variant="outline" onClick={onModifier}>
            {P.modifier}
          </Button>
        </td>
      )}
    </tr>
  )
}

function LigneNiveauEdition({
  agenceId,
  niveau,
  compteActuel,
  onFini,
  onAnnuler,
}: {
  agenceId: string
  niveau: NiveauCaisseCode
  compteActuel: CompteRattachement | null
  onFini: () => void
  onAnnuler: () => void
}) {
  const [compteCaisse, setCompteCaisse] = useState(compteActuel?.account_number ?? null)
  const [motif, setMotif] = useState('')

  const mutation = useMutation({
    mutationFn: () => rattacherNiveauCaisse(agenceId, niveau, compteCaisse, motif.trim()),
    onSuccess: onFini,
  })

  const motifValide = motif.trim().length >= 3
  const idBase = `nc-${agenceId}-${niveau}`

  return (
    <tr className="border-b bg-brand-subtle/30 last:border-0">
      <td className="px-3 py-3 pl-6 align-top text-muted-foreground">
        ↳ {libelleNiveau(niveau)}
      </td>
      <td className="px-3 py-3 align-top">
        <SelecteurCompte
          id={`${idBase}-caisse`}
          label={libelleNiveau(niveau)}
          filtre="saisie"
          valeur={compteCaisse}
          onChange={setCompteCaisse}
          libelleInitial={
            compteActuel ? `${compteActuel.account_number} — ${compteActuel.name}` : null
          }
        />
      </td>
      <td className="px-3 py-3 align-top">
        <div className="space-y-2">
          <div className="space-y-1">
            <Label htmlFor={`${idBase}-motif`}>{P.motif}</Label>
            <Input
              id={`${idBase}-motif`}
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder={P.motifPlaceholder}
            />
          </div>
          {mutation.isError && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{messageRefusCompte(mutation.error, P.echec)}</AlertDescription>
            </Alert>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!motifValide || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? P.enregistrementEnCours : P.enregistrer}
            </Button>
            <Button size="sm" variant="ghost" onClick={onAnnuler}>
              {P.annuler}
            </Button>
          </div>
        </div>
      </td>
    </tr>
  )
}
