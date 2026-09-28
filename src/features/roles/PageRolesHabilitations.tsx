import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAPermission } from '@/features/auth/useProfil'
import {
  creerRole,
  ErreurEcriture,
  lirePermissionsRole,
  listerPermissions,
  listerRolesHabilitations,
  modifierRole,
  remplacerPermissionsRole,
  supprimerRole,
  type EchecEcriture,
  type NouveauRole,
  type PermissionItem,
  type RoleApercu,
  type RolePermissionsDetail,
} from '@/features/roles/api'
import { LIBELLES } from '@/libelles/fr'

const R = LIBELLES.rolesHabilitations

/**
 * Écran « Rôles et habilitations ». LOT 1 (lecture, tous les rôles) + LOT 2 (édition, rôles
 * PERSONNALISÉS uniquement — is_system=false). Un rôle système reste affiché en lecture
 * seule, sans aucun contrôle d'édition : leur édition est le lot 4, après le seed du lot 3.
 */
export function PageRolesHabilitations() {
  const [codeSelectionne, setCodeSelectionne] = useState<string | null>(null)

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <ShieldCheck className="size-5 text-muted-foreground" />
          {R.titre}
        </h1>
        <p className="text-sm text-muted-foreground">{R.sousTitre}</p>
      </header>

      {!codeSelectionne ? (
        <ListeRoles onSelection={setCodeSelectionne} />
      ) : (
        <DetailRole code={codeSelectionne} onRetour={() => setCodeSelectionne(null)} />
      )}
    </div>
  )
}

function estInterdit(erreur: unknown): boolean {
  return erreur instanceof AxiosError && erreur.response?.status === 403
}

/** Message pour une erreur d'ÉCRITURE (lot 2). 409/422 portent un texte serveur déjà
 * spécifique (code déjà utilisé, garde-fou anti-blocage) — affiché tel quel. */
function messageEchecEcriture(echec: EchecEcriture): string {
  switch (echec.type) {
    case 'conflit':
    case 'invalide':
      return echec.message
    case 'interdit':
      return R.echecInterdit
    case 'introuvable':
      return R.echecIntrouvable
    case 'reseau':
      return R.echecReseau
    default:
      return R.echecInattendue
  }
}

function ListeRoles({ onSelection }: { onSelection: (code: string) => void }) {
  const peutCreer = useAPermission('roles.create')

  // Un seul appel : GET /roles/habilitations donne déjà code/nom/is_system/nb_permissions.
  // Volontairement PAS GET /roles (roles.read) — cet écran ne dépend que de
  // roles.permissions.read, voir l'en-tête de features/roles/api.ts.
  const requete = useQuery({
    queryKey: ['roles', 'habilitations'],
    queryFn: listerRolesHabilitations,
  })

  if (requete.isPending) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{R.chargement}</p>
  }
  if (requete.isError) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription>{estInterdit(requete.error) ? R.interdit : R.erreur}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-3">
      {peutCreer && <FormulaireCreationRole onCree={onSelection} />}

      {requete.data.length === 0 ? (
        <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
          {R.listeVide}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{R.colonneCode}</th>
                <th className="px-3 py-2 text-left font-medium">{R.colonneNom}</th>
                <th className="px-3 py-2 text-left font-medium">{R.colonneSysteme}</th>
                <th className="px-3 py-2 text-left font-medium">{R.colonneNbPermissions}</th>
              </tr>
            </thead>
            <tbody>
              {requete.data.map((role) => (
                <LigneRole key={role.code} role={role} onClick={() => onSelection(role.code)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function LigneRole({ role, onClick }: { role: RoleApercu; onClick: () => void }) {
  return (
    <tr
      tabIndex={0}
      role="button"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick()
      }}
      className="cursor-pointer border-b last:border-0 hover:bg-muted/30 focus:bg-muted/50 focus:outline-none"
    >
      <td className="px-3 py-2 font-mono text-xs">{role.code}</td>
      <td className="px-3 py-2">
        <span className="font-medium">{role.name}</span>
        {role.description && (
          <span className="block text-xs text-muted-foreground">{role.description}</span>
        )}
      </td>
      <td className="px-3 py-2">
        <Badge ton={role.is_system ? 'neutral' : 'brand'}>
          {role.is_system ? R.systeme : R.personnalise}
        </Badge>
      </td>
      <td className="px-3 py-2 text-muted-foreground">{R.nbPermissions(role.nb_permissions)}</td>
    </tr>
  )
}

function FormulaireCreationRole({ onCree }: { onCree: (code: string) => void }) {
  const queryClient = useQueryClient()
  const [ouvert, setOuvert] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [echec, setEchec] = useState<EchecEcriture | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      creerRole({
        code: code.trim(),
        name: name.trim(),
        description: description.trim() || null,
      } satisfies NouveauRole),
    onSuccess: (role) => {
      void queryClient.invalidateQueries({ queryKey: ['roles', 'habilitations'] })
      setOuvert(false)
      setCode('')
      setName('')
      setDescription('')
      setEchec(null)
      onCree(role.code)
    },
    onError: (erreur: unknown) =>
      setEchec(erreur instanceof ErreurEcriture ? erreur.echec : { type: 'inattendue' }),
  })

  if (!ouvert) {
    return (
      <Button type="button" size="sm" onClick={() => setOuvert(true)}>
        {R.creerBouton}
      </Button>
    )
  }

  return (
    <form
      className="space-y-3 rounded-md border p-4"
      onSubmit={(e) => {
        e.preventDefault()
        mutation.mutate()
      }}
    >
      <h2 className="text-sm font-semibold">{R.creerTitre}</h2>

      {echec && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{messageEchecEcriture(echec)}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1">
        <Label htmlFor="role-code">{R.champCode}</Label>
        <Input
          id="role-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          pattern="^[A-Z][A-Z0-9_]{1,49}$"
          required
        />
        <p className="text-xs text-muted-foreground">{R.champCodeAide}</p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="role-name">{R.champNom}</Label>
        <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="role-description">{R.champDescription}</Label>
        <Input
          id="role-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          {mutation.isPending ? R.creerEnCours : R.creerConfirmer}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOuvert(false)}>
          {R.annuler}
        </Button>
      </div>
    </form>
  )
}

function libelleModule(module: string): string {
  return R.modules[module] ?? module
}

function grouperParModule(permissions: PermissionItem[]): [string, PermissionItem[]][] {
  const groupes = new Map<string, PermissionItem[]>()
  for (const permission of permissions) {
    const liste = groupes.get(permission.module) ?? []
    liste.push(permission)
    groupes.set(permission.module, liste)
  }
  return [...groupes.entries()].sort(([a], [b]) =>
    libelleModule(a).localeCompare(libelleModule(b)),
  )
}

function DetailRole({ code, onRetour }: { code: string; onRetour: () => void }) {
  const requete = useQuery({
    queryKey: ['roles', 'permissions', code],
    queryFn: () => lirePermissionsRole(code),
  })

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onRetour}>
        <ArrowLeft className="mr-1 size-4" />
        {R.retour}
      </Button>

      {requete.isPending ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{R.detailChargement}</p>
      ) : requete.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {requete.error instanceof AxiosError && requete.error.response?.status === 404
              ? R.detailIntrouvable
              : estInterdit(requete.error)
                ? R.interdit
                : R.detailErreur}
          </AlertDescription>
        </Alert>
      ) : (
        <DetailRoleCharge role={requete.data} onSupprime={onRetour} />
      )}
    </div>
  )
}

function DetailRoleCharge({
  role,
  onSupprime,
}: {
  role: RolePermissionsDetail
  onSupprime: () => void
}) {
  const peutModifier = useAPermission('roles.update')
  const peutGererPermissions = useAPermission('roles.permissions.manage')
  const peutSupprimer = useAPermission('roles.delete')
  const editable = !role.is_system

  return (
    <>
      <header className="flex items-center gap-3 rounded-lg border bg-card p-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">{role.name}</h2>
          <p className="font-mono text-sm text-muted-foreground">{role.code}</p>
          {role.description && (
            <p className="mt-1 text-sm text-muted-foreground">{role.description}</p>
          )}
        </div>
        <Badge ton={role.is_system ? 'neutral' : 'brand'}>
          {role.is_system ? R.systeme : R.personnalise}
        </Badge>
      </header>

      {editable && peutModifier && <SectionMetadonnees role={role} />}

      <section className="space-y-4">
        <h3 className="text-sm font-semibold">{R.permissionsTitre}</h3>
        {editable && peutGererPermissions ? (
          <PanneauPermissions role={role} />
        ) : role.permissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{R.aucunePermission}</p>
        ) : (
          grouperParModule(role.permissions).map(([module, permissions]) => (
            <div key={module} className="rounded-md border p-3">
              <h4 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {libelleModule(module)}
              </h4>
              <ul className="space-y-1">
                {permissions.map((permission) => (
                  <li key={permission.code} className="text-sm">
                    <span className="font-mono text-xs text-muted-foreground">
                      {permission.code}
                    </span>
                    {permission.description && <span> — {permission.description}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      {editable && peutSupprimer && <SectionSuppression role={role} onSupprime={onSupprime} />}
    </>
  )
}

function SectionMetadonnees({ role }: { role: RolePermissionsDetail }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(role.name)
  const [description, setDescription] = useState(role.description ?? '')
  const [echec, setEchec] = useState<EchecEcriture | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      modifierRole(role.code, { name: name.trim(), description: description.trim() || null }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['roles', 'permissions', role.code] })
      void queryClient.invalidateQueries({ queryKey: ['roles', 'habilitations'] })
      setEchec(null)
    },
    onError: (erreur: unknown) =>
      setEchec(erreur instanceof ErreurEcriture ? erreur.echec : { type: 'inattendue' }),
  })

  const modifie = name.trim() !== role.name || (description.trim() || null) !== role.description

  return (
    <section className="space-y-3 rounded-md border p-4">
      <h3 className="text-sm font-semibold">{R.modifierTitre}</h3>

      {echec && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{messageEchecEcriture(echec)}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1">
        <Label htmlFor="role-edit-name">{R.champNom}</Label>
        <Input
          id="role-edit-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="role-edit-description">{R.champDescription}</Label>
        <Input
          id="role-edit-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <Button
        type="button"
        size="sm"
        disabled={!modifie || name.trim() === '' || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? R.enregistrementEnCours : R.enregistrer}
      </Button>
    </section>
  )
}

function PanneauPermissions({ role }: { role: RolePermissionsDetail }) {
  const queryClient = useQueryClient()
  const initiales = new Set(role.permissions.map((p) => p.code))
  const [selection, setSelection] = useState<Set<string>>(() => new Set(initiales))
  const [motif, setMotif] = useState('')
  const [etape, setEtape] = useState<'edition' | 'confirmation'>('edition')
  const [echec, setEchec] = useState<EchecEcriture | null>(null)

  const catalogue = useQuery({ queryKey: ['permissions'], queryFn: listerPermissions })

  const mutation = useMutation({
    mutationFn: () => remplacerPermissionsRole(role.code, [...selection], motif.trim()),
    onSuccess: (detail) => {
      queryClient.setQueryData(['roles', 'permissions', role.code], detail)
      void queryClient.invalidateQueries({ queryKey: ['roles', 'habilitations'] })
      setMotif('')
      setEtape('edition')
      setEchec(null)
    },
    onError: (erreur: unknown) => {
      setEchec(erreur instanceof ErreurEcriture ? erreur.echec : { type: 'inattendue' })
      setEtape('edition')
    },
  })

  function basculer(permissionCode: string) {
    setSelection((courante) => {
      const copie = new Set(courante)
      if (copie.has(permissionCode)) copie.delete(permissionCode)
      else copie.add(permissionCode)
      return copie
    })
  }

  if (catalogue.isPending) {
    return <p className="text-sm text-muted-foreground">{R.catalogueChargement}</p>
  }
  if (catalogue.isError) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription>{R.catalogueErreur}</AlertDescription>
      </Alert>
    )
  }

  const ajoutees = [...selection].filter((c) => !initiales.has(c))
  const retirees = [...initiales].filter((c) => !selection.has(c))
  const modifie = ajoutees.length > 0 || retirees.length > 0
  const groupes = grouperParModule(catalogue.data)

  return (
    <div className="space-y-3 rounded-md border p-4">
      {echec && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{messageEchecEcriture(echec)}</AlertDescription>
        </Alert>
      )}

      <fieldset disabled={etape === 'confirmation' || mutation.isPending} className="space-y-4">
        {groupes.map(([module, permissions]) => (
          <div key={module}>
            <h4 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {libelleModule(module)}
            </h4>
            <ul className="space-y-1">
              {permissions.map((permission) => (
                <li key={permission.code}>
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={selection.has(permission.code)}
                      onChange={() => basculer(permission.code)}
                    />
                    <span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {permission.code}
                      </span>
                      {permission.description && <span> — {permission.description}</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </fieldset>

      {etape === 'edition' ? (
        <>
          <div className="space-y-1">
            <Label htmlFor="role-motif">{R.motifLabel}</Label>
            <Input
              id="role-motif"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">{R.motifAide}</p>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={!modifie || motif.trim() === ''}
            onClick={() => setEtape('confirmation')}
          >
            {R.verifierLesChangements}
          </Button>
        </>
      ) : (
        <div className="space-y-2 rounded-md border border-dashed p-3" role="alert">
          <p className="text-sm">
            {[
              ajoutees.length > 0 ? R.apercuAjoutees(ajoutees.length) : null,
              retirees.length > 0 ? R.apercuRetirees(retirees.length) : null,
            ]
              .filter((texte): texte is string => texte !== null)
              .join(' / ') || R.apercuAucunChangement}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? R.enregistrementEnCours : R.confirmerEtEnregistrer}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEtape('edition')}
              disabled={mutation.isPending}
            >
              {R.revenirALedition}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function SectionSuppression({
  role,
  onSupprime,
}: {
  role: RolePermissionsDetail
  onSupprime: () => void
}) {
  const queryClient = useQueryClient()
  const [confirmation, setConfirmation] = useState(false)
  const [echec, setEchec] = useState<EchecEcriture | null>(null)

  const mutation = useMutation({
    mutationFn: () => supprimerRole(role.code),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['roles', 'habilitations'] })
      onSupprime()
    },
    onError: (erreur: unknown) =>
      setEchec(erreur instanceof ErreurEcriture ? erreur.echec : { type: 'inattendue' }),
  })

  if (!confirmation) {
    return (
      <Button type="button" variant="destructive" size="sm" onClick={() => setConfirmation(true)}>
        {R.supprimerBouton}
      </Button>
    )
  }

  return (
    <div className="space-y-2 rounded-md border border-destructive/50 p-4">
      <p className="text-sm font-medium">{R.supprimerConfirmerTitre(role.name)}</p>
      <p className="text-sm text-muted-foreground">
        {R.supprimerConfirmerTexte(role.permissions.length)}
      </p>

      {echec && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{messageEchecEcriture(echec)}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? R.supprimerEnCours : R.supprimerConfirmer}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setConfirmation(false)}
          disabled={mutation.isPending}
        >
          {R.annuler}
        </Button>
      </div>
    </div>
  )
}
