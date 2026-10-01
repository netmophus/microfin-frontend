import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'

import { SelecteurCompte } from '@/components/comptabilite/selecteur-compte'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAPermission } from '@/features/auth/useProfil'
import {
  TAILLE_PAGE_ECRITURES_OD,
  contrePasserEcritureOD,
  creerEcritureOD,
  listerEcrituresOD,
  messageRefusCompte,
  supprimerEcritureOD,
  validerEcritureOD,
  type EcritureODResume,
} from '@/features/comptabilite/api'
import { formatFcfa } from '@/features/epargne/api'
import { LIBELLES } from '@/libelles/fr'

const E = LIBELLES.ecrituresOD

const CLE_LISTE = ['comptabilite', 'ecritures-od']

function fmt(gabarit: string, valeurs: Record<string, string>): string {
  return gabarit.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '')
}

/**
 * Saisie manuelle d'écriture, journal OD (Opérations diverses) — chantier P1, lot 1. Journal
 * OD UNIQUEMENT : aucun champ de l'écran ne permet d'en choisir un autre, c'est le serveur qui
 * l'impose structurellement (voir comptabilite/ecritures_od.py). Brouillon : peut être
 * déséquilibré, se supprime librement. Validation : exige l'équilibre et >= 2 lignes (les
 * champs `equilibree`/`nb_lignes` déjà calculés côté serveur évitent de les recalculer ici).
 * Contre-passation : réservée à une pièce déjà validée, jamais deux fois.
 */
export function PageEcrituresOD() {
  const client = useQueryClient()
  const [modeCreation, setModeCreation] = useState(false)
  const [page, setPage] = useState(1)
  const [actionEnCours, setActionEnCours] = useState<{
    id: string
    type: 'validation' | 'suppression' | 'contre-passation'
  } | null>(null)

  const requete = useQuery({
    queryKey: [...CLE_LISTE, page],
    queryFn: () => listerEcrituresOD(page),
    placeholderData: keepPreviousData,
  })

  const rafraichir = () => {
    setActionEnCours(null)
    void client.invalidateQueries({ queryKey: CLE_LISTE })
  }

  if (modeCreation) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{E.titre}</h1>
          <p className="text-sm text-muted-foreground">{E.sousTitre}</p>
        </div>
        <FormulaireNouvelleEcriture
          onCreee={() => {
            setModeCreation(false)
            rafraichir()
          }}
          onAnnuler={() => setModeCreation(false)}
        />
      </div>
    )
  }

  const total = requete.data?.total ?? 0
  const taille = requete.data?.taille ?? TAILLE_PAGE_ECRITURES_OD
  const nbPages = Math.max(1, Math.ceil(total / taille))
  const interdit =
    requete.error instanceof AxiosError && requete.error.response?.status === 403

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{E.titre}</h1>
          <p className="text-sm text-muted-foreground">{E.sousTitre}</p>
        </div>
        <Button size="sm" onClick={() => setModeCreation(true)}>
          {E.nouvelle}
        </Button>
      </div>

      {requete.isPending ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{E.chargement}</p>
      ) : requete.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription className="space-y-2">
            <p>{interdit ? E.interdit : E.erreur}</p>
            {!interdit && (
              <Button size="sm" variant="outline" onClick={() => void requete.refetch()}>
                {E.reessayer}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      ) : requete.data.lignes.length === 0 ? (
        <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
          {E.listeVide}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{E.colDate}</th>
                  <th className="px-3 py-2 text-left font-medium">{E.colNumero}</th>
                  <th className="px-3 py-2 text-left font-medium">{E.colDescription}</th>
                  <th className="px-3 py-2 text-right font-medium">{E.colDebit}</th>
                  <th className="px-3 py-2 text-right font-medium">{E.colCredit}</th>
                  <th className="px-3 py-2 text-left font-medium">{E.colStatut}</th>
                  <th className="px-3 py-2" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {requete.data.lignes.map((ecriture) =>
                  actionEnCours?.id === ecriture.id ? (
                    <LigneConfirmation
                      key={ecriture.id}
                      ecriture={ecriture}
                      type={actionEnCours.type}
                      onFini={rafraichir}
                      onAnnuler={() => setActionEnCours(null)}
                    />
                  ) : (
                    <LigneEcriture
                      key={ecriture.id}
                      ecriture={ecriture}
                      onDemanderAction={(type) => setActionEnCours({ id: ecriture.id, type })}
                    />
                  ),
                )}
              </tbody>
            </table>
          </div>

          {nbPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{fmt(E.pagination, { page: String(page), total: String(nbPages) })}</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page <= 1}
                >
                  {E.pagePrecedente}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= nbPages}
                >
                  {E.pageSuivante}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function LigneEcriture({
  ecriture,
  onDemanderAction,
}: {
  ecriture: EcritureODResume
  onDemanderAction: (type: 'validation' | 'suppression' | 'contre-passation') => void
}) {
  const peutPoster = useAPermission('compta.ecriture.post')
  const peutContrePasser = useAPermission('compta.ecriture.reverse')
  const estBrouillon = ecriture.status === 'brouillon'
  const peutValider = ecriture.equilibree && ecriture.nb_lignes >= 2

  const motifBlocageValidation = !ecriture.equilibree
    ? fmt(E.desequilibre, {
        montant: formatFcfa(Math.abs(ecriture.total_debit - ecriture.total_credit)),
      })
    : ecriture.nb_lignes < 2
      ? E.moinsDeDeuxLignes
      : undefined

  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-2 whitespace-nowrap">
        {new Date(ecriture.entry_date).toLocaleDateString('fr-FR')}
      </td>
      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
        {ecriture.entry_number ?? E.brouillonSansNumero}
      </td>
      <td className="px-3 py-2">
        {ecriture.description}
        {ecriture.est_contre_passation && (
          <span className="ml-2">
            <Badge ton="neutral">{E.estContrePassation}</Badge>
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums">
        {formatFcfa(ecriture.total_debit)}
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums">
        {formatFcfa(ecriture.total_credit)}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap items-center gap-1">
          <Badge ton={estBrouillon ? 'warning' : 'success'}>
            {estBrouillon ? E.statutBrouillon : E.statutValidee}
          </Badge>
          {ecriture.deja_contre_passee && <Badge ton="neutral">{E.dejaContrePassee}</Badge>}
        </div>
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-2">
          {estBrouillon && peutPoster && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDemanderAction('validation')}
              disabled={!peutValider}
              title={motifBlocageValidation}
            >
              {E.valider}
            </Button>
          )}
          {estBrouillon && peutPoster && (
            <Button size="sm" variant="ghost" onClick={() => onDemanderAction('suppression')}>
              {E.supprimer}
            </Button>
          )}
          {!estBrouillon && peutContrePasser && !ecriture.deja_contre_passee && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDemanderAction('contre-passation')}
            >
              {E.contrePasser}
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}

function LigneConfirmation({
  ecriture,
  type,
  onFini,
  onAnnuler,
}: {
  ecriture: EcritureODResume
  type: 'validation' | 'suppression' | 'contre-passation'
  onFini: () => void
  onAnnuler: () => void
}) {
  const mutation = useMutation({
    mutationFn: async () => {
      if (type === 'validation') {
        await validerEcritureOD(ecriture.id)
      } else if (type === 'suppression') {
        await supprimerEcritureOD(ecriture.id)
      } else {
        await contrePasserEcritureOD(ecriture.id)
      }
    },
    onSuccess: onFini,
  })

  const libelleAction =
    type === 'validation' ? E.valider : type === 'suppression' ? E.supprimer : E.contrePasser
  const libelleEnCours =
    type === 'validation'
      ? E.validationEnCours
      : type === 'suppression'
        ? E.suppressionEnCours
        : E.contrePassationEnCours
  const question =
    type === 'validation'
      ? E.confirmerValidation
      : type === 'suppression'
        ? E.confirmerSuppression
        : fmt(E.confirmerContrePassation, { numero: ecriture.entry_number ?? '' })

  return (
    <tr className="border-b bg-warning-subtle/30 last:border-0">
      <td className="px-3 py-3" colSpan={7}>
        <p className="text-sm font-medium">{question}</p>
        {mutation.isError && (
          <Alert variant="destructive" role="alert" className="mt-2">
            <AlertDescription>{messageRefusCompte(mutation.error, E.echec)}</AlertDescription>
          </Alert>
        )}
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            variant={type === 'suppression' ? 'destructive' : 'default'}
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? libelleEnCours : libelleAction}
          </Button>
          <Button size="sm" variant="ghost" onClick={onAnnuler} disabled={mutation.isPending}>
            {E.annuler}
          </Button>
        </div>
      </td>
    </tr>
  )
}

interface LigneFormulaire {
  id: string
  account_number: string | null
  side: 'D' | 'C'
  amount: string
  label: string
}

function nouvelleLigne(): LigneFormulaire {
  return { id: crypto.randomUUID(), account_number: null, side: 'D', amount: '', label: '' }
}

function montantSaisi(brut: string): number {
  return Number.parseInt(brut.replace(/\D/g, ''), 10) || 0
}

/**
 * Formulaire multi-lignes — description + date obligatoires, au moins une ligne complète
 * (compte + montant > 0). L'équilibre n'est PAS exigé ici (brouillon = espace de travail) :
 * les totaux et l'écart s'affichent EN DIRECT, à titre indicatif, avant la validation.
 */
function FormulaireNouvelleEcriture({
  onCreee,
  onAnnuler,
}: {
  onCreee: () => void
  onAnnuler: () => void
}) {
  const [description, setDescription] = useState('')
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [lignes, setLignes] = useState<LigneFormulaire[]>([nouvelleLigne(), nouvelleLigne()])

  const majLigne = (id: string, champ: Partial<LigneFormulaire>) => {
    setLignes((ls) => ls.map((l) => (l.id === id ? { ...l, ...champ } : l)))
  }
  const ajouterLigne = () => setLignes((ls) => [...ls, nouvelleLigne()])
  const retirerLigne = (id: string) => setLignes((ls) => ls.filter((l) => l.id !== id))

  const totalDebit = lignes.reduce(
    (s, l) => s + (l.side === 'D' ? montantSaisi(l.amount) : 0),
    0,
  )
  const totalCredit = lignes.reduce(
    (s, l) => s + (l.side === 'C' ? montantSaisi(l.amount) : 0),
    0,
  )
  const equilibree = totalDebit > 0 && totalDebit === totalCredit

  const lignesCompletes = lignes.every((l) => l.account_number && montantSaisi(l.amount) > 0)
  const descriptionValide = description.trim().length > 0
  const peutEnregistrer = descriptionValide && lignes.length > 0 && lignesCompletes

  const mutation = useMutation({
    mutationFn: () =>
      creerEcritureOD({
        entry_date: entryDate,
        description: description.trim(),
        lignes: lignes.map((l) => ({
          account_number: l.account_number as string,
          side: l.side,
          amount: montantSaisi(l.amount),
          label: l.label.trim() || undefined,
        })),
      }),
    onSuccess: onCreee,
  })

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <h2 className="text-sm font-semibold">{E.nouvelleTitre}</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="od-description">{E.champDescription}</Label>
          <Input
            id="od-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={E.champDescriptionPlaceholder}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="od-date">{E.champDate}</Label>
          <Input
            id="od-date"
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-3">
        {lignes.map((ligne, index) => (
          <div
            key={ligne.id}
            className="grid items-end gap-2 rounded-md border bg-muted/20 p-3 sm:grid-cols-[2fr_7rem_8rem_1.5fr_auto]"
          >
            <SelecteurCompte
              id={`od-compte-${ligne.id}`}
              label={fmt(E.ligneNumero, { n: String(index + 1) })}
              filtre="saisie"
              valeur={ligne.account_number}
              onChange={(v) => majLigne(ligne.id, { account_number: v })}
            />
            <div className="space-y-1">
              <Label htmlFor={`od-sens-${ligne.id}`}>{E.colligneSens}</Label>
              <select
                id={`od-sens-${ligne.id}`}
                value={ligne.side}
                onChange={(e) => majLigne(ligne.id, { side: e.target.value as 'D' | 'C' })}
                className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="D">{E.sensDebit}</option>
                <option value="C">{E.sensCredit}</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`od-montant-${ligne.id}`}>{E.colligneMontant}</Label>
              <Input
                id={`od-montant-${ligne.id}`}
                inputMode="numeric"
                value={ligne.amount}
                onChange={(e) => majLigne(ligne.id, { amount: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`od-libelle-${ligne.id}`}>{E.colligneLibelle}</Label>
              <Input
                id={`od-libelle-${ligne.id}`}
                value={ligne.label}
                onChange={(e) => majLigne(ligne.id, { label: e.target.value })}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => retirerLigne(ligne.id)}
              disabled={lignes.length <= 1}
              aria-label={E.retirerLigne}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={ajouterLigne}>
          {E.ajouterLigne}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-md bg-muted/30 p-3 text-sm">
        <span>
          {E.totalDebit} :{' '}
          <strong className="font-mono tabular-nums">{formatFcfa(totalDebit)}</strong>
        </span>
        <span>
          {E.totalCredit} :{' '}
          <strong className="font-mono tabular-nums">{formatFcfa(totalCredit)}</strong>
        </span>
        {equilibree ? (
          <Badge ton="success">{E.equilibree}</Badge>
        ) : (
          <Badge ton="warning">
            {fmt(E.desequilibre, { montant: formatFcfa(Math.abs(totalDebit - totalCredit)) })}
          </Badge>
        )}
      </div>

      {mutation.isError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{messageRefusCompte(mutation.error, E.echec)}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button
          onClick={() => mutation.mutate()}
          disabled={!peutEnregistrer || mutation.isPending}
        >
          {mutation.isPending ? E.enregistrementEnCours : E.enregistrerBrouillon}
        </Button>
        <Button variant="ghost" onClick={onAnnuler} disabled={mutation.isPending}>
          {E.annuler}
        </Button>
      </div>
    </section>
  )
}
