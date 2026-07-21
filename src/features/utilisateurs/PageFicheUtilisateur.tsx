import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useProfil } from '@/features/auth/useProfil'
import { Confirmation } from '@/features/utilisateurs/Confirmation'
import {
  chargerFiche,
  desactiver,
  deverrouiller,
  ErreurAction,
  modifierFiche,
  reactiver,
  reinitialiserMotDePasse,
  supprimer,
  type EchecAction,
  type Fiche,
  type Modifications,
} from '@/features/utilisateurs/fiche-api'
import { FormulaireModification } from '@/features/utilisateurs/FormulaireModification'
import { MotDePasseProvisoire } from '@/features/utilisateurs/MotDePasseProvisoire'
import { SectionRoles } from '@/features/utilisateurs/SectionRoles'
import { LIBELLES } from '@/libelles/fr'

const F = LIBELLES.fiche

/** Vues successives de l'écran. Une seule à la fois, pour ne pas cumuler des panneaux. */
type Vue =
  | { mode: 'fiche' }
  | { mode: 'modifier' }
  | { mode: 'confirmer-desactiver' }
  | { mode: 'confirmer-reinitialiser' }
  | { mode: 'confirmer-supprimer' }
  | { mode: 'mot-de-passe'; valeur: string }

function messageEchec(echec: EchecAction): string {
  switch (echec.type) {
    case 'interdit':
      return F.actionInterdite
    case 'introuvable':
      return F.actionIntrouvable
    case 'conflit':
      return F.actionConflit
    case 'invalide':
      return F.actionInvalide
    case 'reseau':
      return LIBELLES.erreurs.serveurInjoignable
    default:
      return F.actionErreur
  }
}

function formaterDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function PageFicheUtilisateur() {
  const { id = '' } = useParams()
  const naviguer = useNavigate()
  const queryClient = useQueryClient()
  const profil = useProfil()
  const [vue, setVue] = useState<Vue>({ mode: 'fiche' })
  const [echec, setEchec] = useState<EchecAction | null>(null)

  const requete = useQuery({ queryKey: ['utilisateur', id], queryFn: () => chargerFiche(id) })

  // Après toute action, la fiche et la liste doivent refléter le nouvel état.
  const rafraichir = (fiche: Fiche) => {
    queryClient.setQueryData(['utilisateur', id], fiche)
    void queryClient.invalidateQueries({ queryKey: ['utilisateurs'] })
    setVue({ mode: 'fiche' })
  }

  const surErreur = (erreur: unknown) => {
    setEchec(erreur instanceof ErreurAction ? erreur.echec : { type: 'inattendue' })
    setVue({ mode: 'fiche' })
  }

  const modification = useMutation({
    mutationFn: (m: Modifications) => modifierFiche(id, m),
    onSuccess: rafraichir,
    onError: surErreur,
  })
  const changementEtat = useMutation({
    mutationFn: (action: 'desactiver' | 'reactiver' | 'deverrouiller') =>
      action === 'desactiver'
        ? desactiver(id)
        : action === 'reactiver'
          ? reactiver(id)
          : deverrouiller(id),
    onSuccess: rafraichir,
    onError: surErreur,
  })
  const reinit = useMutation({
    mutationFn: () => reinitialiserMotDePasse(id),
    onSuccess: (valeur) => {
      // Les sessions ont été révoquées côté serveur ; la fiche peut avoir changé.
      void queryClient.invalidateQueries({ queryKey: ['utilisateur', id] })
      void queryClient.invalidateQueries({ queryKey: ['utilisateurs'] })
      setVue({ mode: 'mot-de-passe', valeur })
    },
    onError: surErreur,
  })
  const suppression = useMutation({
    mutationFn: () => supprimer(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['utilisateurs'] })
      void naviguer('/', { replace: true })
    },
    onError: surErreur,
  })

  const enCours =
    modification.isPending || changementEtat.isPending || reinit.isPending || suppression.isPending

  if (requete.isPending) {
    return <p className="py-8 text-sm text-muted-foreground">{F.chargement}</p>
  }
  if (requete.isError) {
    const introuvable =
      requete.error instanceof ErreurAction && requete.error.echec.type === 'introuvable'
    return (
      <div className="space-y-4">
        <RetourListe />
        <Alert variant="destructive" role="alert">
          <AlertDescription>{introuvable ? F.introuvable : F.erreur}</AlertDescription>
        </Alert>
      </div>
    )
  }

  const fiche = requete.data
  const estSoiMeme = profil.data?.id === fiche.id
  const perms = profil.data?.permissions ?? []
  const peut = (p: string) => perms.includes(p)

  // ÉTAT terminal : le mot de passe réinitialisé, traité EXACTEMENT comme à la création.
  if (vue.mode === 'mot-de-passe') {
    return (
      <MotDePasseProvisoire
        nom={`${fiche.first_name} ${fiche.last_name}`.trim() || fiche.username}
        motDePasse={vue.valeur}
        onTermine={() => setVue({ mode: 'fiche' })}
      />
    )
  }

  return (
    <div className="max-w-3xl space-y-5">
      <RetourListe />

      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {fiche.first_name} {fiche.last_name}
        </h1>
        <p className="text-sm text-muted-foreground">{fiche.username}</p>
      </div>

      {echec && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{messageEchec(echec)}</AlertDescription>
        </Alert>
      )}

      {vue.mode === 'modifier' ? (
        <FormulaireModification
          fiche={fiche}
          enCours={modification.isPending}
          onEnregistrer={(m) => modification.mutate(m)}
          onAnnuler={() => setVue({ mode: 'fiche' })}
        />
      ) : (
        <>
          <Details fiche={fiche} />

          {/* Section Rôles : visible seulement si roles.assign. Sur sa propre fiche, elle
              s'affiche en lecture seule avec l'explication (on ne modifie pas ses rôles). */}
          {peut('roles.assign') && (
            <SectionRoles
              fiche={fiche}
              modifiable={!estSoiMeme}
              motifLectureSeule={estSoiMeme ? LIBELLES.roles.lectureSeule : undefined}
            />
          )}

          {/* Confirmations : une à la fois, sinon les actions directes. */}
          {vue.mode === 'confirmer-desactiver' && (
            <Confirmation
              titre={F.desactiverTitre}
              avertissement={F.desactiverAvertissement}
              libelleConfirmer={F.desactiver}
              enCours={changementEtat.isPending}
              onConfirmer={() => changementEtat.mutate('desactiver')}
              onAnnuler={() => setVue({ mode: 'fiche' })}
            />
          )}
          {vue.mode === 'confirmer-reinitialiser' && (
            <Confirmation
              titre={F.reinitialiserTitre}
              avertissement={F.reinitialiserAvertissement}
              libelleConfirmer={F.reinitialiser}
              enCours={reinit.isPending}
              onConfirmer={() => reinit.mutate()}
              onAnnuler={() => setVue({ mode: 'fiche' })}
            />
          )}
          {vue.mode === 'confirmer-supprimer' && (
            <Confirmation
              titre={F.supprimerTitre}
              avertissement={F.supprimerAvertissement}
              libelleConfirmer={F.supprimerConfirmer}
              danger
              enCours={suppression.isPending}
              onConfirmer={() => suppression.mutate()}
              onAnnuler={() => setVue({ mode: 'fiche' })}
            />
          )}

          {vue.mode === 'fiche' && (
            <Actions
              fiche={fiche}
              estSoiMeme={estSoiMeme}
              peut={peut}
              enCours={enCours}
              setVue={setVue}
              reactiver={() => changementEtat.mutate('reactiver')}
              deverrouiller={() => changementEtat.mutate('deverrouiller')}
            />
          )}
        </>
      )}
    </div>
  )
}

function RetourListe() {
  return (
    <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" aria-hidden />
      {F.retour}
    </Link>
  )
}

function Ligne({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-2 py-1.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}

function Details({ fiche }: { fiche: Fiche }) {
  return (
    <dl className="divide-y rounded-md border px-4 py-1">
      <Ligne label={F.matricule}>{fiche.matricule}</Ligne>
      <Ligne label={F.identifiant}>{fiche.username}</Ligne>
      <Ligne label={F.email}>{fiche.email}</Ligne>
      <Ligne label={F.telephone}>{fiche.phone ?? F.sansValeur}</Ligne>
      <Ligne label={F.agence}>{fiche.agence_principale?.name ?? F.sansValeur}</Ligne>
      <Ligne label={F.statut}>{fiche.is_active ? F.actif : F.inactif}</Ligne>
      <Ligne label={F.verrouillage}>
        {fiche.is_locked
          ? fiche.locked_until
            ? F.verrouilleJusqua(formaterDate(fiche.locked_until))
            : F.actif
          : F.nonVerrouille}
      </Ligne>
      <Ligne label={F.motDePasse}>
        {fiche.must_change_password ? F.renouvellementRequis : F.renouvellementNonRequis}
      </Ligne>
      <Ligne label={F.creeLe}>{formaterDate(fiche.created_at)}</Ligne>
      <Ligne label={F.modifieLe}>{formaterDate(fiche.updated_at)}</Ligne>
    </dl>
  )
}

/**
 * Barre d'actions. Chaque bouton n'apparaît que si la permission est détenue, et les actions
 * sur autrui uniquement (jamais sur son propre compte, que le serveur refuserait). La
 * suppression exige EN PLUS la portée réseau.
 */
function Actions({
  fiche,
  estSoiMeme,
  peut,
  enCours,
  setVue,
  reactiver,
  deverrouiller,
}: {
  fiche: Fiche
  estSoiMeme: boolean
  peut: (p: string) => boolean
  enCours: boolean
  setVue: (v: Vue) => void
  reactiver: () => void
  deverrouiller: () => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {/* Modifier : permis même sur son propre compte (entretenir sa fiche n'est pas se
            soustraire à un contrôle). */}
        {peut('users.update') && (
          <Button variant="outline" size="sm" disabled={enCours} onClick={() => setVue({ mode: 'modifier' })}>
            {F.modifier}
          </Button>
        )}

        {/* Désactiver / Réactiver : le bouton suit l'état. Interdit sur soi-même. */}
        {peut('users.update') &&
          !estSoiMeme &&
          (fiche.is_active ? (
            <Button
              variant="outline"
              size="sm"
              disabled={enCours}
              onClick={() => setVue({ mode: 'confirmer-desactiver' })}
            >
              {F.desactiver}
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled={enCours} onClick={reactiver}>
              {F.reactiver}
            </Button>
          ))}

        {/* Déverrouiller : seulement si verrouillé, et pas sur soi-même. */}
        {peut('users.unlock') && !estSoiMeme && fiche.is_locked && (
          <Button variant="outline" size="sm" disabled={enCours} onClick={deverrouiller}>
            {F.deverrouiller}
          </Button>
        )}

        {/* Réinitialiser le mot de passe : pas sur soi-même (la voie propre est
            /auth/change-password, qui exige l'ancien mot de passe). */}
        {peut('users.reset_password') && !estSoiMeme && (
          <Button
            variant="outline"
            size="sm"
            disabled={enCours}
            onClick={() => setVue({ mode: 'confirmer-reinitialiser' })}
          >
            {F.reinitialiser}
          </Button>
        )}

        {/* Supprimer : users.delete ET portée réseau. Jamais sur soi-même. */}
        {peut('users.delete') && peut('perimetre.reseau') && !estSoiMeme && (
          <Button
            variant="destructive"
            size="sm"
            disabled={enCours}
            onClick={() => setVue({ mode: 'confirmer-supprimer' })}
          >
            {F.supprimer}
          </Button>
        )}
      </div>

      {estSoiMeme && (peut('users.update') || peut('users.delete')) && (
        <p className="text-xs text-muted-foreground">{F.surSoiMeme}</p>
      )}
    </div>
  )
}
