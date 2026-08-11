import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAPermission } from '@/features/auth/useProfil'
import {
  assignerGuichetier,
  changerActivationPoste,
  creerPoste,
  listerAssignations,
  listerPostes,
  messageRefusCaisse,
  rattacherComptePoste,
  renommerPoste,
  revoquerAssignation,
  type PosteCaisse,
  type UtilisateurAssigne,
} from '@/features/caisse/api'
import { listerComptesSelecteur, type CompteSelecteur } from '@/features/comptabilite/api'
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
  const comptes = useQuery({
    queryKey: ['comptabilite', 'comptes-selecteur'],
    queryFn: () => listerComptesSelecteur(),
    enabled: peutRattacherCompte,
  })

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
                      comptes={comptes.data}
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
  comptes,
  onFini,
}: {
  poste: PosteCaisse
  edition: ModeEdition | null
  setEdition: (mode: ModeEdition | null) => void
  deplie: boolean
  onDeplier: () => void
  peutGererPoste: boolean
  peutRattacherCompte: boolean
  comptes: CompteSelecteur[] | undefined
  onFini: () => void
}) {
  if (edition?.id === poste.id && edition.type === 'nom') {
    return <LigneNom poste={poste} onFini={onFini} onAnnuler={() => setEdition(null)} />
  }
  if (edition?.id === poste.id && edition.type === 'compte') {
    return (
      <LigneRattachement
        poste={poste}
        comptes={comptes ?? []}
        onFini={onFini}
        onAnnuler={() => setEdition(null)}
      />
    )
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
  comptes,
  onFini,
  onAnnuler,
}: {
  poste: PosteCaisse
  comptes: CompteSelecteur[]
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
          <div className="space-y-1">
            <Label htmlFor={`${idBase}-compte`}>{P.colonneCompte}</Label>
            <select
              id={`${idBase}-compte`}
              className="h-9 w-full rounded-md border bg-background px-2 text-xs"
              value={compteCaisse ?? ''}
              onChange={(e) => setCompteCaisse(e.target.value || null)}
            >
              <option value="">{P.aucun}</option>
              {comptes.map((c) => (
                <option key={c.id} value={c.account_number}>
                  {c.account_number} — {c.name}
                </option>
              ))}
            </select>
          </div>
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
