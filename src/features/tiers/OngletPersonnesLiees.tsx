import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAPermission } from '@/features/auth/useProfil'
import { lireTier } from '@/features/tiers/api'
import { BadgeStatut } from '@/features/tiers/badges'
import {
  ajouterPersonneLiee,
  ErreurLien,
  listerPersonnesLiees,
  modifierPersonneLiee,
  rechercherPersonnes,
  retirerPersonneLiee,
  type LienPersonne,
  type RoleLien,
} from '@/features/tiers/personnesLiees'
import { LIBELLES } from '@/libelles/fr'

const L = LIBELLES.tiersLiees
const SELECT =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs disabled:opacity-50'

const ROLES_GROUPEMENT: RoleLien[] = ['representant_legal', 'dirigeant', 'membre_bureau', 'signataire']
const ROLES_SOCIETE: RoleLien[] = [
  'representant_legal',
  'dirigeant',
  'membre_bureau',
  'beneficiaire_effectif',
  'signataire',
]

function formaterDate(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('fr-FR')
}

function formaterPourcentage(valeur: string | null): string {
  if (valeur === null) return '—'
  return Number(valeur).toLocaleString('fr-FR', { maximumFractionDigits: 2 })
}

type Panneau = { type: 'modifier' | 'retirer'; lien: LienPersonne } | null

/** Onglet « Personnes liées » d'une société ou d'un groupement : représentant légal, dirigeants,
 *  membres du bureau, signataires, et (sociétés seulement) bénéficiaires effectifs, séparés avec
 *  leur détention cumulée. Tout vient du serveur, y compris « en cours » (journée comptable). */
export function OngletPersonnesLiees({
  tierId,
  tierType,
  personneInitiale,
}: {
  tierId: string
  tierType: string
  personneInitiale?: string | null
}) {
  const peutGerer = useAPermission('tiers.update')
  const [formOuvert, setFormOuvert] = useState(Boolean(personneInitiale))
  const [panneau, setPanneau] = useState<Panneau>(null)
  const requete = useQuery({
    queryKey: ['tiers', 'personnes-liees', tierId],
    queryFn: () => listerPersonnesLiees(tierId),
  })

  if (requete.isPending) {
    return <p className="py-4 text-sm text-muted-foreground">{L.chargement}</p>
  }
  if (requete.isError) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription className="space-y-2">
          <p>{L.erreur}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => void requete.refetch()}>
            {L.reessayer}
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const vue = requete.data
  const societe = tierType === 'legal_entity'
  const enCours = vue.items.filter((i) => i.en_cours)
  const liens = enCours.filter((i) => i.role !== 'beneficiaire_effectif')
  const beneficiaires = enCours.filter((i) => i.role === 'beneficiaire_effectif')
  const termines = vue.items.filter((i) => !i.en_cours)

  return (
    <div className="space-y-5">
      {/* État partiel : la liste est là, l'indicateur de seuil ne peut pas être calculé. */}
      {societe && vue.seuil === null && (
        <Alert>
          <AlertDescription>{L.seuilAbsent}</AlertDescription>
        </Alert>
      )}

      {vue.items.length === 0 ? (
        <div className="rounded-md border border-dashed p-4 text-sm">
          <p className="font-medium">{L.vide}</p>
          <p className="mt-1 text-muted-foreground">
            {L.videAide} {!peutGerer && L.videAideLecture}
          </p>
        </div>
      ) : (
        <>
          {liens.length > 0 && (
            <Section titre={L.titreLiens}>
              <TableauLiens
                liens={liens}
                peutGerer={peutGerer}
                onAction={(type, lien) => setPanneau({ type, lien })}
              />
            </Section>
          )}
          {societe && (
            <Section titre={L.titreBeneficiaires}>
              {beneficiaires.length === 0 ? (
                <p className="text-sm text-muted-foreground">—</p>
              ) : (
                <TableauLiens
                  liens={beneficiaires}
                  peutGerer={peutGerer}
                  onAction={(type, lien) => setPanneau({ type, lien })}
                />
              )}
              <p className="mt-2 text-sm">
                {L.totalBeneficiaires} :{' '}
                <span className="font-mono tabular-nums font-medium">
                  {formaterPourcentage(vue.total_beneficiaires)} %
                </span>
                {vue.seuil !== null && (
                  <span className="text-muted-foreground">
                    {' '}
                    — {L.seuil} :{' '}
                    <span className="font-mono tabular-nums">{formaterPourcentage(vue.seuil)} %</span>
                    {vue.seuil_provisoire && ` (${L.seuilProvisoire})`}
                  </span>
                )}
              </p>
            </Section>
          )}
          {termines.length > 0 && (
            <Section titre={L.titreTermines}>
              <TableauLiens liens={termines} peutGerer={false} onAction={() => undefined} termines />
            </Section>
          )}
        </>
      )}

      {panneau?.type === 'modifier' && (
        <PanneauModifier
          key={panneau.lien.id}
          tierId={tierId}
          lien={panneau.lien}
          onFin={() => setPanneau(null)}
        />
      )}
      {panneau?.type === 'retirer' && (
        <PanneauRetirer
          key={panneau.lien.id}
          tierId={tierId}
          lien={panneau.lien}
          onFin={() => setPanneau(null)}
        />
      )}

      {peutGerer &&
        (formOuvert ? (
          <FormLien
            tierId={tierId}
            roles={societe ? ROLES_SOCIETE : ROLES_GROUPEMENT}
            journeeReference={vue.journee_reference}
            personneInitiale={personneInitiale ?? null}
            onFin={() => setFormOuvert(false)}
          />
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-primary"
            onClick={() => setFormOuvert(true)}
          >
            <Plus />
            {L.ajouter}
          </Button>
        ))}
    </div>
  )
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">{titre}</h3>
      {children}
    </section>
  )
}

function TableauLiens({
  liens,
  peutGerer,
  onAction,
  termines = false,
}: {
  liens: LienPersonne[]
  peutGerer: boolean
  onAction: (type: 'modifier' | 'retirer', lien: LienPersonne) => void
  termines?: boolean
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              {L.colNom}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {L.colStatut}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {L.colRole}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {L.colFonction}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              {L.colPourcentage}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {L.colSignature}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {L.colDepuis}
            </th>
            {termines && (
              <th scope="col" className="px-3 py-2 font-medium">
                {L.colJusqua}
              </th>
            )}
            {peutGerer && (
              <th scope="col" className="px-3 py-2 font-medium">
                {L.colActions}
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y">
          {liens.map((lien) => (
            <tr key={lien.id} className={termines ? 'text-muted-foreground' : undefined}>
              <td className="px-3 py-2">
                <Link
                  to={`/tiers/${lien.individual_tier_id}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {lien.nom}
                </Link>
                <div className="font-mono text-xs text-muted-foreground">{lien.tier_number}</div>
              </td>
              <td className="px-3 py-2">
                <BadgeStatut code={lien.statut} />
              </td>
              <td className="px-3 py-2">{L.roles[lien.role] ?? lien.role}</td>
              <td className="px-3 py-2">{lien.fonction ?? '—'}</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">
                {formaterPourcentage(lien.pourcentage_detention)}
                {lien.atteint_le_seuil && (
                  <span className="ml-2 font-sans text-xs font-medium text-warning">{L.seuilAtteint}</span>
                )}
              </td>
              <td className="px-3 py-2">{lien.pouvoir_signature ? L.oui : L.non}</td>
              <td className="px-3 py-2 font-mono tabular-nums">{formaterDate(lien.date_debut)}</td>
              {termines && (
                <td className="px-3 py-2 font-mono tabular-nums">{formaterDate(lien.date_fin)}</td>
              )}
              {peutGerer && (
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`${L.modifier} ${lien.nom}`}
                      onClick={() => onAction('modifier', lien)}
                    >
                      {L.modifier}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      aria-label={`${L.retirer} ${lien.nom}`}
                      onClick={() => onAction('retirer', lien)}
                    >
                      {L.retirer}
                    </Button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MessageEchec({ message }: { message: string | null }) {
  if (message === null) return null
  return (
    <Alert variant="destructive" role="alert">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

function messageDe(erreur: unknown): string {
  return erreur instanceof ErreurLien && erreur.detail ? erreur.detail : L.erreurEnregistrement
}

function PanneauRetirer({ tierId, lien, onFin }: { tierId: string; lien: LienPersonne; onFin: () => void }) {
  const queryClient = useQueryClient()
  const [motif, setMotif] = useState('')
  const [echec, setEchec] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: () => retirerPersonneLiee(tierId, lien.id, motif.trim()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tiers'] })
      onFin()
    },
    onError: (e) => setEchec(messageDe(e)),
  })
  const confirmer = () => {
    if (!motif.trim()) {
      setEchec(L.motifRequis)
      return
    }
    setEchec(null)
    mutation.mutate()
  }
  return (
    <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
      <p className="text-sm font-medium">
        {L.retirerTitre} {lien.nom} — {L.roles[lien.role] ?? lien.role}
      </p>
      <p className="text-sm text-muted-foreground">{L.retirerRappel}</p>
      <Label htmlFor="lien-motif">{L.motif}</Label>
      <Input id="lien-motif" value={motif} onChange={(e) => setMotif(e.target.value)} />
      <MessageEchec message={echec} />
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={mutation.isPending}
          onClick={confirmer}
        >
          {L.confirmerRetrait}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onFin}>
          {L.annuler}
        </Button>
      </div>
    </div>
  )
}

function PanneauModifier({ tierId, lien, onFin }: { tierId: string; lien: LienPersonne; onFin: () => void }) {
  const queryClient = useQueryClient()
  const beneficiaire = lien.role === 'beneficiaire_effectif'
  const [fonction, setFonction] = useState(lien.fonction ?? '')
  const [pourcentage, setPourcentage] = useState(lien.pourcentage_detention ?? '')
  const [signature, setSignature] = useState(lien.pouvoir_signature)
  const [debut, setDebut] = useState(lien.date_debut)
  const [fin, setFin] = useState(lien.date_fin ?? '')
  const [echec, setEchec] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      modifierPersonneLiee(tierId, lien.id, {
        fonction: fonction.trim() || null,
        ...(beneficiaire ? { pourcentage_detention: pourcentage.trim() } : {}),
        pouvoir_signature: signature,
        date_debut: debut,
        date_fin: fin || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tiers'] })
      onFin()
    },
    onError: (e) => setEchec(messageDe(e)),
  })

  const enregistrer = () => {
    if (!debut) return setEchec(L.requisDateDebut)
    if (fin && fin < debut) return setEchec(L.periodeIncoherente)
    if (beneficiaire && !pourcentageValide(pourcentage)) return setEchec(L.requisPourcentage)
    setEchec(null)
    mutation.mutate()
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="text-sm font-medium">
        {L.modifierTitre} : {lien.nom} — {L.roles[lien.role] ?? lien.role}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="mod-fonction">{L.fonction}</Label>
          <Input id="mod-fonction" value={fonction} onChange={(e) => setFonction(e.target.value)} />
        </div>
        {beneficiaire && (
          <div className="space-y-1.5">
            <Label htmlFor="mod-pourcentage">{L.pourcentage}</Label>
            <Input
              id="mod-pourcentage"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={pourcentage}
              onChange={(e) => setPourcentage(e.target.value)}
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="mod-debut">{L.dateDebut}</Label>
          <Input id="mod-debut" type="date" value={debut} onChange={(e) => setDebut(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mod-fin">{L.dateFin}</Label>
          <Input id="mod-fin" type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={signature} onChange={(e) => setSignature(e.target.checked)} />
        {L.pouvoirSignature}
      </label>
      <MessageEchec message={echec} />
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={mutation.isPending} onClick={enregistrer}>
          {mutation.isPending ? L.enregistrement : L.enregistrer}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onFin}>
          {L.annuler}
        </Button>
      </div>
    </div>
  )
}

function pourcentageValide(valeur: string): boolean {
  if (valeur.trim() === '') return false
  const nombre = Number(valeur)
  return Number.isFinite(nombre) && nombre >= 0 && nombre <= 100
}

function FormLien({
  tierId,
  roles,
  journeeReference,
  personneInitiale,
  onFin,
}: {
  tierId: string
  roles: RoleLien[]
  journeeReference: string
  personneInitiale: string | null
  onFin: () => void
}) {
  const queryClient = useQueryClient()
  const [personne, setPersonne] = useState<{ id: string; nom: string } | null>(null)
  const [rechercheLibre, setRechercheLibre] = useState(false)
  const [role, setRole] = useState<RoleLien | ''>('')
  const [fonction, setFonction] = useState('')
  const [pourcentage, setPourcentage] = useState('')
  const [signature, setSignature] = useState(false)
  // Date MÉTIER (nomination, entrée en fonction) : proposée à la journée comptable, modifiable.
  const [debut, setDebut] = useState(journeeReference)
  const [fin, setFin] = useState('')
  const [echec, setEchec] = useState<string | null>(null)

  // Retour de la création d'une personne : elle arrive déjà choisie.
  const initiale = useQuery({
    queryKey: ['tiers', 'fiche', personneInitiale],
    queryFn: () => lireTier(personneInitiale ?? ''),
    enabled: Boolean(personneInitiale) && !rechercheLibre,
  })
  const choisie =
    personne ??
    (!rechercheLibre && initiale.data?.individu
      ? {
          id: initiale.data.id,
          nom: `${initiale.data.individu.last_name} ${initiale.data.individu.first_name}`,
        }
      : null)

  const beneficiaire = role === 'beneficiaire_effectif'

  const mutation = useMutation({
    mutationFn: () =>
      ajouterPersonneLiee(tierId, {
        individual_tier_id: choisie?.id ?? '',
        role: role as RoleLien,
        fonction: fonction.trim() || null,
        pourcentage_detention: beneficiaire ? pourcentage.trim() : null,
        pouvoir_signature: signature,
        date_debut: debut,
        date_fin: fin || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tiers'] })
      onFin()
    },
    onError: (e) => setEchec(messageDe(e)),
  })

  const enregistrer = () => {
    if (!choisie) return setEchec(L.requisPersonne)
    if (!role) return setEchec(L.requisRole)
    if (beneficiaire && !pourcentageValide(pourcentage)) return setEchec(L.requisPourcentage)
    if (!debut) return setEchec(L.requisDateDebut)
    if (fin && fin < debut) return setEchec(L.periodeIncoherente)
    setEchec(null)
    mutation.mutate()
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="text-sm font-medium">{L.ajouter}</p>

      {choisie ? (
        <div className="flex items-center justify-between gap-2 rounded bg-muted/40 px-3 py-2 text-sm">
          <span>
            {L.personneChoisie} : <span className="font-medium">{choisie.nom}</span>
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setPersonne(null)
              setRechercheLibre(true)
            }}
          >
            {L.changerPersonne}
          </Button>
        </div>
      ) : (
        <RecherchePersonne tierId={tierId} onChoix={setPersonne} />
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="lien-role">{L.role}</Label>
          <select
            id="lien-role"
            className={SELECT}
            value={role}
            onChange={(e) => setRole(e.target.value as RoleLien | '')}
          >
            <option value="">{L.roleChoisir}</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {L.roles[r]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lien-fonction">{L.fonction}</Label>
          <Input id="lien-fonction" value={fonction} onChange={(e) => setFonction(e.target.value)} />
        </div>
        {beneficiaire && (
          <div className="space-y-1.5">
            <Label htmlFor="lien-pourcentage">{L.pourcentage}</Label>
            <Input
              id="lien-pourcentage"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={pourcentage}
              onChange={(e) => setPourcentage(e.target.value)}
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="lien-debut">{L.dateDebut}</Label>
          <Input
            id="lien-debut"
            type="date"
            required
            aria-required
            value={debut}
            onChange={(e) => setDebut(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{L.dateDebutAide}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lien-fin">{L.dateFin}</Label>
          <Input id="lien-fin" type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={signature} onChange={(e) => setSignature(e.target.checked)} />
        {L.pouvoirSignature}
      </label>

      <MessageEchec message={echec} />

      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={mutation.isPending} onClick={enregistrer}>
          {mutation.isPending ? L.enregistrement : L.enregistrer}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onFin}>
          {L.annuler}
        </Button>
      </div>
    </div>
  )
}

function RecherchePersonne({
  tierId,
  onChoix,
}: {
  tierId: string
  onChoix: (personne: { id: string; nom: string }) => void
}) {
  const [q, setQ] = useState('')
  const actif = q.trim().length >= 2
  const resultats = useQuery({
    queryKey: ['tiers', 'recherche-personnes', q.trim()],
    queryFn: () => rechercherPersonnes(q),
    enabled: actif,
  })
  return (
    <div className="space-y-2">
      <Label htmlFor="lien-recherche">{L.recherche}</Label>
      <Input id="lien-recherche" value={q} onChange={(e) => setQ(e.target.value)} />
      {!actif && <p className="text-xs text-muted-foreground">{L.rechercheAide}</p>}
      {actif && resultats.isPending && <p className="text-sm text-muted-foreground">{L.chargement}</p>}
      {actif && resultats.isError && <p className="text-sm text-destructive">{L.rechercheErreur}</p>}
      {actif && resultats.isSuccess && resultats.data.length === 0 && (
        <p className="text-sm text-muted-foreground">{L.rechercheVide}</p>
      )}
      {actif && resultats.isSuccess && resultats.data.length > 0 && (
        <ul className="divide-y rounded-md border">
          {resultats.data.map((ligne) => (
            <li key={ligne.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted/40"
                onClick={() => onChoix({ id: ligne.id, nom: ligne.display_name })}
              >
                <span className="font-medium">{ligne.display_name}</span>
                <span className="font-mono text-xs text-muted-foreground">{ligne.tier_number}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Link
        to={`/tiers/nouveau?retour=${tierId}`}
        className="inline-block text-sm text-primary underline underline-offset-2"
      >
        {L.creerPersonne}
      </Link>
    </div>
  )
}
