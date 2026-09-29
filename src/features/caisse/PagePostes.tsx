import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { useState } from 'react'

import { SelecteurCompte } from '@/components/comptabilite/selecteur-compte'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAPermission, useProfil } from '@/features/auth/useProfil'
import {
  assignerGuichetier,
  changerActivationPoste,
  creerPoste,
  designerCaissierPrincipal,
  listerAssignations,
  listerPostes,
  lireCaissierPrincipal,
  messageRefusCaisse,
  rattacherComptePoste,
  renommerPoste,
  retirerCaissierPrincipal,
  revoquerAssignation,
  type PosteCaisse,
  type UtilisateurAssigne,
} from '@/features/caisse/api'
import { listerUtilisateurs } from '@/features/utilisateurs/api'
import { LIBELLES } from '@/libelles/fr'

const P = LIBELLES.postesCaisse

type ModeEdition =
  | { id: string; type: 'nom' | 'compte' | 'activation' }
  | { id: 'nouveau'; type: 'nom' }

/**
 * Postes de caisse (Bloc B) — CRUD réservé caisse.poste.manage (RESPONSABLE_AGENCE, SON
 * agence), rattachement comptable réservé compta.plan.manage (institution entière, comme les
 * 3 autres écrans Bloc 5), assignation des guichetiers réservée caisse.poste.manage. Même
 * patron que PagePaliersSouffrance.tsx (une ligne à la fois en édition), avec une ligne
 * d'assignations dépliable en plus.
 */
export function PagePostes() {
  const client = useQueryClient()
  const [edition, setEdition] = useState<ModeEdition | null>(null)
  const [deplie, setDeplie] = useState<string | null>(null)
  const peutGererPoste = useAPermission('caisse.poste.manage')
  const peutRattacherCompte = useAPermission('compta.plan.manage')

  const postes = useQuery({ queryKey: ['caisse', 'postes'], queryFn: listerPostes })

  const rafraichir = () => {
    setEdition(null)
    void client.invalidateQueries({ queryKey: ['caisse', 'postes'] })
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{P.titre}</h1>
        <p className="text-sm text-muted-foreground">{P.sousTitre}</p>
      </div>

      <SectionCaissierPrincipal />

      {postes.isPending ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{P.chargement}</p>
      ) : postes.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {postes.error instanceof AxiosError && postes.error.response?.status === 403
              ? P.interdit
              : P.erreur}
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {peutGererPoste && edition?.id !== 'nouveau' && (
            <Button size="sm" onClick={() => setEdition({ id: 'nouveau', type: 'nom' })}>
              {P.ajouter}
            </Button>
          )}

          {postes.data.length === 0 && edition?.id !== 'nouveau' && (
            <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
              {P.listeVide}
            </p>
          )}

          {(postes.data.length > 0 || edition?.id === 'nouveau') && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">{P.colonneAgence}</th>
                    <th className="px-3 py-2 text-left font-medium">{P.colonnePoste}</th>
                    <th className="px-3 py-2 text-left font-medium">{P.colonneCompte}</th>
                    <th className="px-3 py-2 text-left font-medium">{P.colonneStatut}</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {edition?.id === 'nouveau' && (
                    <LigneNom onFini={rafraichir} onAnnuler={() => setEdition(null)} />
                  )}
                  {postes.data.map((poste) => (
                    <LignePoste
                      key={poste.id}
                      poste={poste}
                      edition={edition}
                      setEdition={setEdition}
                      deplie={deplie === poste.id}
                      onDeplier={() => setDeplie(deplie === poste.id ? null : poste.id)}
                      peutGererPoste={peutGererPoste}
                      peutRattacherCompte={peutRattacherCompte}
                      onFini={rafraichir}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function LignePoste({
  poste,
  edition,
  setEdition,
  deplie,
  onDeplier,
  peutGererPoste,
  peutRattacherCompte,
  onFini,
}: {
  poste: PosteCaisse
  edition: ModeEdition | null
  setEdition: (mode: ModeEdition | null) => void
  deplie: boolean
  onDeplier: () => void
  peutGererPoste: boolean
  peutRattacherCompte: boolean
  onFini: () => void
}) {
  if (edition?.id === poste.id && edition.type === 'nom') {
    return <LigneNom poste={poste} onFini={onFini} onAnnuler={() => setEdition(null)} />
  }
  if (edition?.id === poste.id && edition.type === 'compte') {
    return <LigneRattachement poste={poste} onFini={onFini} onAnnuler={() => setEdition(null)} />
  }
  if (edition?.id === poste.id && edition.type === 'activation') {
    return <LigneActivation poste={poste} onFini={onFini} onAnnuler={() => setEdition(null)} />
  }

  return (
    <>
      <tr className="border-b last:border-0">
        <td className="px-3 py-2">
          <span className="font-medium">{poste.agency_nom}</span>
        </td>
        <td className="px-3 py-2">
          <span className="font-medium">{poste.libelle}</span>
          <span className="ml-2 font-mono text-xs text-muted-foreground">{poste.code}</span>
        </td>
        <td className="px-3 py-2">
          {poste.compte_caisse_number ? (
            <span className="font-mono text-xs">
              {poste.compte_caisse_number} — {poste.compte_caisse_name}
            </span>
          ) : (
            <span className="text-muted-foreground">{P.aucun}</span>
          )}
        </td>
        <td className="px-3 py-2">
          <Badge ton={poste.is_active ? 'success' : 'danger'}>
            {poste.is_active ? P.actif : P.inactif}
          </Badge>
        </td>
        <td className="px-3 py-2 text-right">
          <div className="flex flex-wrap justify-end gap-2">
            {peutGererPoste && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEdition({ id: poste.id, type: 'nom' })}
                >
                  {P.renommer}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEdition({ id: poste.id, type: 'activation' })}
                >
                  {poste.is_active ? P.desactiver : P.activer}
                </Button>
                <Button size="sm" variant="ghost" onClick={onDeplier}>
                  {P.voirAssignations}
                </Button>
              </>
            )}
            {peutRattacherCompte && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEdition({ id: poste.id, type: 'compte' })}
              >
                {P.rattacherCompte}
              </Button>
            )}
          </div>
        </td>
      </tr>
      {deplie && (
        <tr className="border-b bg-muted/20 last:border-0">
          <td className="px-3 py-3" colSpan={5}>
            <LigneAssignations poste={poste} />
          </td>
        </tr>
      )}
    </>
  )
}

function LigneNom({
  poste,
  onFini,
  onAnnuler,
}: {
  poste?: PosteCaisse
  onFini: () => void
  onAnnuler: () => void
}) {
  const [code, setCode] = useState(poste?.code ?? '')
  const [libelle, setLibelle] = useState(poste?.libelle ?? '')
  const [motif, setMotif] = useState('')

  const codeValide = code.trim().length > 0
  const libelleValide = libelle.trim().length > 0
  const motifValide = motif.trim().length >= 3
  const valide = codeValide && libelleValide && motifValide

  const mutation = useMutation({
    mutationFn: () =>
      poste
        ? renommerPoste(poste.id, code.trim(), libelle.trim(), motif.trim())
        : creerPoste(code.trim(), libelle.trim(), motif.trim()),
    onSuccess: onFini,
  })

  const idBase = poste ? `pc-${poste.id}` : 'pc-nouveau'

  return (
    <tr className="border-b bg-brand-subtle/30 last:border-0">
      <td className="px-3 py-3 align-top" colSpan={5}>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor={`${idBase}-code`}>{P.code}</Label>
            <Input
              id={`${idBase}-code`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={P.codePlaceholder}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor={`${idBase}-libelle`}>{P.libelle}</Label>
            <Input
              id={`${idBase}-libelle`}
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              placeholder={P.libellePlaceholder}
            />
          </div>
          <div className="space-y-1 sm:col-span-3">
            <Label htmlFor={`${idBase}-motif`}>{P.motif}</Label>
            <Input
              id={`${idBase}-motif`}
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder={P.motifPlaceholder}
            />
          </div>
        </div>

        {mutation.isError && (
          <Alert variant="destructive" role="alert" className="mt-3">
            <AlertDescription>{messageRefusCaisse(mutation.error, P.echec)}</AlertDescription>
          </Alert>
        )}

        <div className="mt-3 flex gap-2">
          <Button size="sm" disabled={!valide || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? P.enregistrementEnCours : P.enregistrer}
          </Button>
          <Button size="sm" variant="ghost" onClick={onAnnuler} disabled={mutation.isPending}>
            {P.annuler}
          </Button>
        </div>
      </td>
    </tr>
  )
}

function LigneRattachement({
  poste,
  onFini,
  onAnnuler,
}: {
  poste: PosteCaisse
  onFini: () => void
  onAnnuler: () => void
}) {
  const [compteCaisse, setCompteCaisse] = useState(poste.compte_caisse_number)
  const [motif, setMotif] = useState('')
  const motifValide = motif.trim().length >= 3

  const mutation = useMutation({
    mutationFn: () => rattacherComptePoste(poste.id, compteCaisse, motif.trim()),
    onSuccess: onFini,
  })

  const idBase = `pr-${poste.id}`

  return (
    <tr className="border-b bg-brand-subtle/30 last:border-0">
      <td className="px-3 py-3 align-top" colSpan={5}>
        <p className="mb-2 text-sm">
          {poste.agency_nom} — <span className="font-medium">{poste.libelle}</span> ({poste.code})
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <SelecteurCompte
            id={`${idBase}-compte`}
            label={P.colonneCompte}
            filtre="saisie"
            valeur={compteCaisse}
            onChange={setCompteCaisse}
            libelleInitial={
              poste.compte_caisse_number
                ? `${poste.compte_caisse_number} — ${poste.compte_caisse_name}`
                : null
            }
          />
          <div className="space-y-1">
            <Label htmlFor={`${idBase}-motif`}>{P.motif}</Label>
            <Input
              id={`${idBase}-motif`}
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder={P.motifPlaceholder}
            />
          </div>
        </div>

        {mutation.isError && (
          <Alert variant="destructive" role="alert" className="mt-3">
            <AlertDescription>{messageRefusCaisse(mutation.error, P.echec)}</AlertDescription>
          </Alert>
        )}

        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            disabled={!motifValide || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? P.enregistrementEnCours : P.enregistrer}
          </Button>
          <Button size="sm" variant="ghost" onClick={onAnnuler} disabled={mutation.isPending}>
            {P.annuler}
          </Button>
        </div>
      </td>
    </tr>
  )
}

function LigneActivation({
  poste,
  onFini,
  onAnnuler,
}: {
  poste: PosteCaisse
  onFini: () => void
  onAnnuler: () => void
}) {
  const [motif, setMotif] = useState('')
  const motifValide = motif.trim().length >= 3
  const cible = !poste.is_active // ce qu'on demande, l'inverse de l'état actuel

  const mutation = useMutation({
    mutationFn: () => changerActivationPoste(poste.id, cible, motif.trim()),
    onSuccess: onFini,
  })

  return (
    <tr className="border-b bg-warning-subtle/30 last:border-0">
      <td className="px-3 py-3 align-top" colSpan={5}>
        <p className="text-sm">
          {cible ? P.confirmerActivation : P.confirmerDesactivation} —{' '}
          <span className="font-medium">{poste.libelle}</span> ({poste.code})
        </p>
        <div className="mt-2 space-y-1">
          <Label htmlFor={`pa-${poste.id}-motif`}>{P.motif}</Label>
          <Input
            id={`pa-${poste.id}-motif`}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder={P.motifPlaceholder}
          />
        </div>

        {mutation.isError && (
          <Alert variant="destructive" role="alert" className="mt-2">
            <AlertDescription>{messageRefusCaisse(mutation.error, P.echecActivation)}</AlertDescription>
          </Alert>
        )}

        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            variant={cible ? 'default' : 'destructive'}
            disabled={!motifValide || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? P.enregistrementEnCours : cible ? P.activer : P.desactiver}
          </Button>
          <Button size="sm" variant="ghost" onClick={onAnnuler} disabled={mutation.isPending}>
            {P.annuler}
          </Button>
        </div>
      </td>
    </tr>
  )
}

function LigneAssignations({ poste }: { poste: PosteCaisse }) {
  const client = useQueryClient()
  const [choix, setChoix] = useState('')

  const assignes = useQuery({
    queryKey: ['caisse', 'postes', poste.id, 'assignations'],
    queryFn: () => listerAssignations(poste.id),
  })
  const guichetiers = useQuery({
    queryKey: ['utilisateurs', 'selecteur', poste.agency_id],
    queryFn: () => listerUtilisateurs({ agence: poste.agency_id, role: 'CAISSIER', taille: 100 }),
  })

  const rafraichirAssignes = () =>
    client.invalidateQueries({ queryKey: ['caisse', 'postes', poste.id, 'assignations'] })

  const assignation = useMutation({
    mutationFn: (userId: string) => assignerGuichetier(poste.id, userId),
    onSuccess: () => {
      setChoix('')
      void rafraichirAssignes()
    },
  })
  const revocation = useMutation({
    mutationFn: (userId: string) => revoquerAssignation(poste.id, userId),
    onSuccess: () => void rafraichirAssignes(),
  })

  const assignesIds = new Set((assignes.data ?? []).map((u) => u.id))
  const disponibles = (guichetiers.data?.lignes ?? []).filter((u) => !assignesIds.has(u.id))

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {P.assignationsTitre}
      </p>

      {assignes.isPending ? (
        <p className="text-sm text-muted-foreground">{P.chargement}</p>
      ) : assignes.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{P.erreur}</AlertDescription>
        </Alert>
      ) : assignes.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{P.assignationsAucun}</p>
      ) : (
        <ul className="space-y-1">
          {assignes.data.map((u: UtilisateurAssigne) => (
            <li key={u.id} className="flex items-center justify-between text-sm">
              <span>
                {u.nom_complet} <span className="font-mono text-xs text-muted-foreground">{u.matricule}</span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={revocation.isPending}
                onClick={() => revocation.mutate(u.id)}
              >
                {P.retirer}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <select
          className="h-9 flex-1 rounded-md border bg-background px-2 text-xs"
          value={choix}
          onChange={(e) => setChoix(e.target.value)}
        >
          <option value="">{P.choisirUnGuichetier}</option>
          {disponibles.map((u) => (
            <option key={u.id} value={u.id}>
              {u.first_name} {u.last_name} — {u.matricule}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          disabled={!choix || assignation.isPending}
          onClick={() => assignation.mutate(choix)}
        >
          {P.assigner}
        </Button>
      </div>

      {(assignation.isError || revocation.isError) && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {messageRefusCaisse(assignation.error ?? revocation.error, P.echecAssignation)}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

// --- Caissier principal (sous-chantier 3, Lots A-C) --------------------------------------------
// Responsabilité NOMINATIVE de la caisse PRINCIPALE de l'agence — sur CET écran (pas « Caisse
// par agence », purement comptable) : même acteur (RESPONSABLE_AGENCE), même nature de décision
// (qui manipule quelle caisse) que la gestion des postes et l'assignation des guichetiers
// ci-dessus. Gardé caisse.principale.manage — JAMAIS d'appel serveur pour qui ne détient pas
// cette permission : le GET est lui-même gardé côté backend (lecture ET écriture réservées au
// même acteur), un fetch inconditionnel produirait un 403 mal habillé (constaté, corrigé).
// L'agence ciblée est celle du PROFIL de l'acteur (`agence_courante`, claim du jeton) — un
// RESPONSABLE_AGENCE ne gère jamais que la sienne (égalité stricte, voir transferts.py).

function SectionCaissierPrincipal() {
  const peutGererPrincipal = useAPermission('caisse.principale.manage')
  const profil = useProfil()
  const agence = profil.data?.agence_courante

  if (!peutGererPrincipal) return null
  if (!agence) return null // pas d'agence courante (cas limite) : rien à afficher

  return (
    <div className="rounded-md border p-4">
      <p className="text-sm font-medium">{P.caissierPrincipalTitre}</p>
      <p className="mb-3 text-xs text-muted-foreground">{P.caissierPrincipalSousTitre}</p>
      <CaissierPrincipalContenu agenceId={agence.id} />
    </div>
  )
}

function CaissierPrincipalContenu({ agenceId }: { agenceId: string }) {
  const client = useQueryClient()
  const [enEdition, setEnEdition] = useState(false)

  const requete = useQuery({
    queryKey: ['caisse', 'caissier-principal', agenceId],
    queryFn: () => lireCaissierPrincipal(agenceId),
  })

  const rafraichir = () => {
    setEnEdition(false)
    void client.invalidateQueries({ queryKey: ['caisse', 'caissier-principal', agenceId] })
  }

  if (requete.isPending) {
    return <p className="text-sm text-muted-foreground">{P.chargement}</p>
  }
  if (requete.isError) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription>{P.erreur}</AlertDescription>
      </Alert>
    )
  }

  if (enEdition) {
    return (
      <CaissierPrincipalEdition
        agenceId={agenceId}
        caissierActuel={requete.data.caissier_principal}
        onFini={rafraichir}
        onAnnuler={() => setEnEdition(false)}
      />
    )
  }

  const caissier = requete.data.caissier_principal

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">
        {caissier ? (
          <>
            {caissier.nom_complet}{' '}
            <span className="font-mono text-xs text-muted-foreground">{caissier.matricule}</span>
          </>
        ) : (
          <span className="text-muted-foreground">{P.caissierPrincipalNonDesigne}</span>
        )}
      </span>
      <Button size="sm" variant="outline" onClick={() => setEnEdition(true)}>
        {P.caissierPrincipalModifier}
      </Button>
    </div>
  )
}

function CaissierPrincipalEdition({
  agenceId,
  caissierActuel,
  onFini,
  onAnnuler,
}: {
  agenceId: string
  caissierActuel: UtilisateurAssigne | null
  onFini: () => void
  onAnnuler: () => void
}) {
  const [userId, setUserId] = useState(caissierActuel?.id ?? '')
  const [motif, setMotif] = useState('')

  const caissiers = useQuery({
    queryKey: ['utilisateurs', 'selecteur', agenceId, 'CAISSIER'],
    queryFn: () => listerUtilisateurs({ agence: agenceId, role: 'CAISSIER', taille: 100 }),
  })

  const motifValide = motif.trim().length >= 3

  const designation = useMutation({
    mutationFn: () => designerCaissierPrincipal(agenceId, userId, motif.trim()),
    onSuccess: onFini,
  })
  const retrait = useMutation({
    mutationFn: () => retirerCaissierPrincipal(agenceId),
    onSuccess: onFini,
  })

  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="cp-caissier">{P.caissierPrincipalLabel}</Label>
          <select
            id="cp-caissier"
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="">{P.choisirUnCaissier}</option>
            {(caissiers.data?.lignes ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.first_name} {u.last_name} — {u.matricule}
              </option>
            ))}
          </select>
          {caissiers.data?.lignes.length === 0 && (
            <p className="text-xs text-muted-foreground">{P.aucunCaissierEligible}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="cp-motif">{P.motif}</Label>
          <Input
            id="cp-motif"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder={P.motifPlaceholder}
          />
        </div>
      </div>

      {designation.isError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {messageRefusCaisse(designation.error, P.echecCaissierPrincipal)}
          </AlertDescription>
        </Alert>
      )}
      {retrait.isError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {messageRefusCaisse(retrait.error, P.echecRetraitCaissierPrincipal)}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!userId || !motifValide || designation.isPending}
          onClick={() => designation.mutate()}
        >
          {designation.isPending ? P.enregistrementEnCours : P.enregistrer}
        </Button>
        {caissierActuel && (
          <Button
            size="sm"
            variant="destructive"
            disabled={retrait.isPending}
            onClick={() => retrait.mutate()}
          >
            {retrait.isPending ? P.enregistrementEnCours : P.retirer}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onAnnuler} disabled={designation.isPending}>
          {P.annuler}
        </Button>
      </div>
    </div>
  )
}
