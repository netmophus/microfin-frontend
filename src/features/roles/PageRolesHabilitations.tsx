import { useQuery } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  lirePermissionsRole,
  listerRolesHabilitations,
  type PermissionItem,
  type RoleApercu,
} from '@/features/roles/api'
import { LIBELLES } from '@/libelles/fr'

const R = LIBELLES.rolesHabilitations

/**
 * Écran « Rôles et habilitations » — LOT 1, LECTURE SEULE. Liste des rôles (badge Système,
 * nombre de permissions) puis détail d'un rôle choisi (permissions groupées par module).
 * Aucune case à cocher, aucun bouton Enregistrer/Créer — la fondation de lecture sur laquelle
 * les lots suivants (édition) s'appuieront.
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

function ListeRoles({ onSelection }: { onSelection: (code: string) => void }) {
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
  if (requete.data.length === 0) {
    return (
      <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
        {R.listeVide}
      </p>
    )
  }

  return (
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
        <>
          <header className="flex items-center gap-3 rounded-lg border bg-card p-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold">{requete.data.name}</h2>
              <p className="font-mono text-sm text-muted-foreground">{requete.data.code}</p>
              {requete.data.description && (
                <p className="mt-1 text-sm text-muted-foreground">{requete.data.description}</p>
              )}
            </div>
            <Badge ton={requete.data.is_system ? 'neutral' : 'brand'}>
              {requete.data.is_system ? R.systeme : R.personnalise}
            </Badge>
          </header>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold">{R.permissionsTitre}</h3>
            {requete.data.permissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{R.aucunePermission}</p>
            ) : (
              grouperParModule(requete.data.permissions).map(([module, permissions]) => (
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
        </>
      )}
    </div>
  )
}
