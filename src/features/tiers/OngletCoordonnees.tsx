import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MapPin, Mail, Phone, Plus, Star, Trash2, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAPermission } from '@/features/auth/useProfil'
import { BadgePrincipal } from '@/features/tiers/badges'
import {
  ajouterAdresse,
  ajouterEmail,
  ajouterTelephone,
  definirPrincipalContact,
  ErreurTelephone,
  listerContacts,
  supprimerContact,
  type Contact,
} from '@/features/tiers/coordonnees'
import { LIBELLES } from '@/libelles/fr'

const C = LIBELLES.tiersCoordonnees

function sousType(code: string | null): string | null {
  return code ? (C.sousTypes[code] ?? code) : null
}

function libelleAdresse(c: Contact): string {
  const parts = [c.address_line1, c.quarter, c.landmark].filter((p) => p?.trim())
  return parts.join(' · ') || C.adresses
}

export function OngletCoordonnees({ tierId }: { tierId: string }) {
  const peutGerer = useAPermission('tiers.update')
  const requete = useQuery({
    queryKey: ['tiers', 'contacts', tierId],
    queryFn: () => listerContacts(tierId),
  })

  if (requete.isPending) {
    return <p className="py-4 text-sm text-muted-foreground">{C.chargement}</p>
  }
  if (requete.isError) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription>{C.erreur}</AlertDescription>
      </Alert>
    )
  }

  const contacts = requete.data
  const telephones = contacts.filter((c) => c.contact_type === 'phone')
  const emails = contacts.filter((c) => c.contact_type === 'email')
  const adresses = contacts.filter((c) => c.contact_type === 'address')

  return (
    <div className="space-y-6">
      <GroupeTelephones tierId={tierId} contacts={telephones} peutGerer={peutGerer} />
      <GroupeEmails tierId={tierId} contacts={emails} peutGerer={peutGerer} />
      <GroupeAdresses tierId={tierId} contacts={adresses} peutGerer={peutGerer} />
    </div>
  )
}

/** En-tête + liste + zone d'ajout, factorisé pour les trois groupes. */
function Groupe({
  titre,
  vide,
  children,
  ajout,
}: {
  titre: string
  vide: boolean
  children: React.ReactNode
  ajout: React.ReactNode
}) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">{titre}</h3>
      {vide ? <p className="text-sm text-muted-foreground">{C.vide}</p> : <ul className="space-y-2">{children}</ul>}
      <div className="mt-2">{ajout}</div>
    </section>
  )
}

/** Une ligne : valeur + badges + actions (principal / supprimer), avec la suppression in situ. */
function LigneContact({
  tierId,
  contact,
  valeur,
  drapeau,
  peutGerer,
  icone: Icone,
}: {
  tierId: string
  contact: Contact
  valeur: string
  drapeau?: string
  peutGerer: boolean
  icone: LucideIcon
}) {
  const queryClient = useQueryClient()
  const rafraichir = () => void queryClient.invalidateQueries({ queryKey: ['tiers'] })
  const [suppr, setSuppr] = useState(false)
  const [motif, setMotif] = useState('')

  const principal = useMutation({
    mutationFn: () => definirPrincipalContact(tierId, contact.id),
    onSuccess: rafraichir,
  })
  const suppression = useMutation({
    mutationFn: () => supprimerContact(tierId, contact.id, motif || null),
    onSuccess: () => {
      setSuppr(false)
      rafraichir()
    },
  })

  return (
    <li className="rounded-md border p-2.5 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Icone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="break-all">{valeur}</span>
          {sousType(contact.contact_subtype) && (
            <span className="text-xs text-muted-foreground">
              ({sousType(contact.contact_subtype)})
            </span>
          )}
          {contact.is_primary && <BadgePrincipal />}
          {drapeau && <Badge ton="warning">{drapeau}</Badge>}
        </div>
        {peutGerer && (
          <div className="flex shrink-0 gap-1">
            {!contact.is_primary && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                title={C.definirPrincipal}
                aria-label={C.definirPrincipal}
                disabled={principal.isPending}
                onClick={() => principal.mutate()}
              >
                <Star />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-destructive hover:text-destructive"
              title={C.supprimer}
              aria-label={C.supprimer}
              onClick={() => setSuppr(true)}
            >
              <Trash2 />
            </Button>
          </div>
        )}
      </div>

      {suppr && (
        <div className="mt-2 space-y-2 rounded border border-destructive/40 bg-destructive/5 p-2">
          <p className="text-sm font-medium">{C.supprimerTitre}</p>
          <Input
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder={C.motifPlaceholder}
            aria-label={C.motif}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={suppression.isPending}
              onClick={() => suppression.mutate()}
            >
              {C.confirmerSuppression}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setSuppr(false)}>
              {C.annuler}
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}

function GroupeTelephones({
  tierId,
  contacts,
  peutGerer,
}: {
  tierId: string
  contacts: Contact[]
  peutGerer: boolean
}) {
  return (
    <Groupe
      titre={C.telephones}
      vide={contacts.length === 0}
      ajout={peutGerer && <FormTelephone tierId={tierId} />}
    >
      {contacts.map((c) => (
        <LigneContact
          key={c.id}
          tierId={tierId}
          contact={c}
          valeur={c.phone_number ?? c.phone_raw ?? ''}
          drapeau={c.phone_normalized ? undefined : C.forceLabel}
          peutGerer={peutGerer}
          icone={Phone}
        />
      ))}
    </Groupe>
  )
}

function GroupeEmails({
  tierId,
  contacts,
  peutGerer,
}: {
  tierId: string
  contacts: Contact[]
  peutGerer: boolean
}) {
  return (
    <Groupe
      titre={C.emails}
      vide={contacts.length === 0}
      ajout={peutGerer && <FormEmail tierId={tierId} />}
    >
      {contacts.map((c) => (
        <LigneContact
          key={c.id}
          tierId={tierId}
          contact={c}
          valeur={c.email_address ?? ''}
          peutGerer={peutGerer}
          icone={Mail}
        />
      ))}
    </Groupe>
  )
}

function GroupeAdresses({
  tierId,
  contacts,
  peutGerer,
}: {
  tierId: string
  contacts: Contact[]
  peutGerer: boolean
}) {
  return (
    <Groupe
      titre={C.adresses}
      vide={contacts.length === 0}
      ajout={peutGerer && <FormAdresse tierId={tierId} />}
    >
      {contacts.map((c) => (
        <LigneContact
          key={c.id}
          tierId={tierId}
          contact={c}
          valeur={libelleAdresse(c)}
          peutGerer={peutGerer}
          icone={MapPin}
        />
      ))}
    </Groupe>
  )
}

/** Bouton « Ajouter » qui déplie un formulaire. Réinitialisé à la fermeture. */
function ZoneAjout({
  libelle,
  ouvert,
  setOuvert,
  children,
}: {
  libelle: string
  ouvert: boolean
  setOuvert: (v: boolean) => void
  children: React.ReactNode
}) {
  if (!ouvert) {
    return (
      <Button type="button" variant="ghost" size="sm" className="text-primary" onClick={() => setOuvert(true)}>
        <Plus />
        {libelle}
      </Button>
    )
  }
  return <div className="rounded-md border p-3">{children}</div>
}

function FormTelephone({ tierId }: { tierId: string }) {
  const queryClient = useQueryClient()
  const [ouvert, setOuvert] = useState(false)
  const [phone, setPhone] = useState('')
  const [principal, setPrincipal] = useState(false)
  const [refus, setRefus] = useState<string | null>(null)
  const [forcable, setForcable] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const fermer = () => {
    setOuvert(false)
    setPhone('')
    setPrincipal(false)
    setRefus(null)
    setForcable(false)
    setErreur(null)
  }

  const mutation = useMutation({
    mutationFn: (forcer: boolean) =>
      ajouterTelephone(tierId, { phone, is_primary: principal, forcer }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tiers'] })
      fermer()
    },
    onError: (e) => {
      if (e instanceof ErreurTelephone) {
        // Refus : on montre le message. « Enregistrer quand même » n'apparaît QUE si forcable.
        setRefus(e.message)
        setForcable(e.forcable)
      } else {
        setErreur(C.erreurGenerique)
      }
    },
  })

  const soumettre = () => {
    setRefus(null)
    setForcable(false)
    setErreur(null)
    mutation.mutate(false)
  }

  return (
    <ZoneAjout libelle={C.ajouterTelephone} ouvert={ouvert} setOuvert={setOuvert}>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="tel-numero">{C.numero}</Label>
          <Input
            id="tel-numero"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={C.numeroPlaceholder}
            autoFocus
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={principal} onChange={(e) => setPrincipal(e.target.checked)} />
          {C.marquerPrincipal}
        </label>

        {refus && (
          <div className="space-y-2 rounded border border-amber-300 bg-amber-50 p-3">
            <p className="text-sm font-medium">{C.forcerTitre}</p>
            <p className="text-sm">{refus}</p>
            {forcable && <p className="text-sm text-muted-foreground">{C.forcerAide}</p>}
            {forcable && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate(true)}
              >
                {C.forcerConfirmer}
              </Button>
            )}
          </div>
        )}
        {erreur && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{erreur}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button type="button" size="sm" disabled={mutation.isPending || !phone.trim()} onClick={soumettre}>
            {mutation.isPending ? C.enCours : C.ajouter}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={fermer}>
            {C.annuler}
          </Button>
        </div>
      </div>
    </ZoneAjout>
  )
}

function FormEmail({ tierId }: { tierId: string }) {
  const queryClient = useQueryClient()
  const [ouvert, setOuvert] = useState(false)
  const [email, setEmail] = useState('')
  const [principal, setPrincipal] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const fermer = () => {
    setOuvert(false)
    setEmail('')
    setPrincipal(false)
    setErreur(null)
  }

  const mutation = useMutation({
    mutationFn: () => ajouterEmail(tierId, { email, is_primary: principal }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tiers'] })
      fermer()
    },
    onError: () => setErreur(C.erreurGenerique),
  })

  return (
    <ZoneAjout libelle={C.ajouterEmail} ouvert={ouvert} setOuvert={setOuvert}>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="email-adr">{C.email}</Label>
          <Input
            id="email-adr"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={C.emailPlaceholder}
            autoFocus
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={principal} onChange={(e) => setPrincipal(e.target.checked)} />
          {C.marquerPrincipal}
        </label>
        {erreur && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{erreur}</AlertDescription>
          </Alert>
        )}
        <div className="flex gap-2">
          <Button type="button" size="sm" disabled={mutation.isPending || !email.trim()} onClick={() => mutation.mutate()}>
            {mutation.isPending ? C.enCours : C.ajouter}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={fermer}>
            {C.annuler}
          </Button>
        </div>
      </div>
    </ZoneAjout>
  )
}

function FormAdresse({ tierId }: { tierId: string }) {
  const queryClient = useQueryClient()
  const [ouvert, setOuvert] = useState(false)
  const [rue, setRue] = useState('')
  const [quartier, setQuartier] = useState('')
  const [repere, setRepere] = useState('')
  const [principal, setPrincipal] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const fermer = () => {
    setOuvert(false)
    setRue('')
    setQuartier('')
    setRepere('')
    setPrincipal(false)
    setErreur(null)
  }

  const mutation = useMutation({
    mutationFn: () =>
      ajouterAdresse(tierId, {
        address_line1: rue.trim() || null,
        quarter: quartier.trim() || null,
        landmark: repere.trim() || null,
        is_primary: principal,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tiers'] })
      fermer()
    },
    onError: () => setErreur(C.erreurGenerique),
  })

  // Miroir du backend : rue OU repère. On refuse localement le formulaire vide, message clair.
  const valide = Boolean(rue.trim() || repere.trim())

  const soumettre = () => {
    setErreur(null)
    if (!valide) {
      setErreur(C.adresseVide)
      return
    }
    mutation.mutate()
  }

  return (
    <ZoneAjout libelle={C.ajouterAdresse} ouvert={ouvert} setOuvert={setOuvert}>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{C.adresseIntro}</p>
        {/* Les DEUX modes côte à côte, d'égale importance : le repère n'est pas une option cachée. */}
        <div className="space-y-1.5">
          <Label htmlFor="adr-rue">{C.rue}</Label>
          <Input id="adr-rue" value={rue} onChange={(e) => setRue(e.target.value)} placeholder={C.ruePlaceholder} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="adr-repere">{C.repere}</Label>
          <Input
            id="adr-repere"
            value={repere}
            onChange={(e) => setRepere(e.target.value)}
            placeholder={C.reperePlaceholder}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="adr-quartier">{C.quartier}</Label>
          <Input id="adr-quartier" value={quartier} onChange={(e) => setQuartier(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={principal} onChange={(e) => setPrincipal(e.target.checked)} />
          {C.marquerPrincipal}
        </label>
        {erreur && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{erreur}</AlertDescription>
          </Alert>
        )}
        <div className="flex gap-2">
          <Button type="button" size="sm" disabled={mutation.isPending} onClick={soumettre}>
            {mutation.isPending ? C.enCours : C.ajouter}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={fermer}>
            {C.annuler}
          </Button>
        </div>
      </div>
    </ZoneAjout>
  )
}
