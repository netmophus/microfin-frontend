import { Combobox } from '@base-ui/react/combobox'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronDown, X } from 'lucide-react'
import { useRef, useState } from 'react'

import { Label } from '@/components/ui/label'
import {
  listerComptes,
  listerComptesSelecteur,
  listerComptesSelecteurRapport,
} from '@/features/comptabilite/api'
import { useDebounce } from '@/lib/useDebounce'
import { cn } from '@/lib/utils'
import { LIBELLES } from '@/libelles/fr'

const S = LIBELLES.selecteurCompte

/**
 * Où chercher, et ce que représente la valeur choisie :
 *  - 'saisie' -> /comptes/selecteur (comptes de SAISIE actifs seulement) ; valeur = account_number.
 *    Les 6 écrans de rattachement (caisse agence, caisse poste, épargne, parts, écarts CA2/CA3,
 *    paliers de souffrance) : le numéro est ce que les endpoints PATCH/POST de rattachement
 *    attendent.
 *  - 'tous' -> /comptabilite/comptes (comptes de saisie ET de regroupement) ; valeur =
 *    account_number. Le champ Compte parent à la création : un parent est le plus souvent un
 *    compte de regroupement, exclu du sélecteur ci-dessus.
 *  - 'rapport' -> /comptes/selecteur-rapport (comptes de saisie actifs OU désactivés) ; valeur =
 *    l'id (UUID) du compte, pas son numéro — c'est ce que l'endpoint du grand livre attend
 *    (`compte_id`), à la différence de tous les autres cas.
 */
export type FiltreSelecteurCompte = 'saisie' | 'tous' | 'rapport'

interface Option {
  value: string
  label: string
  inactif?: boolean
}

async function chargerOptions(filtre: FiltreSelecteurCompte, q: string): Promise<Option[]> {
  if (filtre === 'saisie') {
    const comptes = await listerComptesSelecteur(q)
    return comptes.map((c) => ({ value: c.account_number, label: `${c.account_number} — ${c.name}` }))
  }
  if (filtre === 'rapport') {
    const comptes = await listerComptesSelecteurRapport(q)
    return comptes.map((c) => ({
      value: c.id,
      label: c.is_active
        ? `${c.account_number} — ${c.name}`
        : S.optionDesactive(c.account_number, c.name),
      inactif: !c.is_active,
    }))
  }
  const page = await listerComptes({ q, page: 1 })
  return page.lignes.map((c) => ({ value: c.account_number, label: `${c.account_number} — ${c.name}` }))
}

interface SelecteurCompteProps {
  id: string
  label: string
  filtre: FiltreSelecteurCompte
  valeur: string | null
  onChange: (valeur: string | null) => void
  /** Numéro + libellé déjà connus par l'appelant pour la valeur courante (édition d'un
   * rattachement existant) — évite un aller-retour réseau juste pour afficher un libellé que
   * l'écran a déjà sous la main. */
  libelleInitial?: string | null
  disabled?: boolean
  className?: string
}

export function SelecteurCompte({
  id,
  label,
  filtre,
  valeur,
  onChange,
  libelleInitial,
  disabled,
  className,
}: SelecteurCompteProps) {
  const [saisie, setSaisie] = useState(libelleInitial ?? '')
  const rechercheDifferee = useDebounce(saisie)

  const requete = useQuery({
    queryKey: ['comptabilite', 'selecteur-compte', filtre, rechercheDifferee],
    queryFn: () => chargerOptions(filtre, rechercheDifferee),
  })

  const options = requete.data ?? []

  // Ce que le champ affiche pour la DERNIÈRE valeur confirmée (sélection dans la liste, valeur
  // initiale reçue de l'appelant, ou effacement) — jamais recalculé depuis `options`, qui peut
  // être en cours de chargement ou en retard sur la frappe (debounce). Comparer la saisie à cette
  // référence, plutôt qu'à la liste des résultats de recherche, évite un repli en texte libre qui
  // dépendrait d'une course avec le réseau.
  const derniereValeurConfirmeeRef = useRef(libelleInitial ?? '')

  const gererSelection = (v: string | null) => {
    derniereValeurConfirmeeRef.current = v ? (options.find((o) => o.value === v)?.label ?? v) : ''
    onChange(v)
  }

  // Saisie libre (filtre 'saisie'/'tous' seulement — 'rapport' est une pure sélection, l'id
  // libre n'aurait aucun sens) : si le texte tapé diffère de la dernière valeur confirmée au
  // moment de quitter le champ, on le transmet tel quel. La validation serveur (déjà en place)
  // reste seule autorité ; ce champ est un confort, pas un filtre bloquant.
  const surPerteDeFocus = () => {
    if (filtre === 'rapport') return
    const texte = saisie.trim()
    if (texte === derniereValeurConfirmeeRef.current.trim()) return
    derniereValeurConfirmeeRef.current = texte
    onChange(texte || null)
  }

  return (
    <div className={cn('space-y-1', className)}>
      <Label htmlFor={id}>{label}</Label>
      <Combobox.Root
        items={options}
        filter={null}
        value={valeur}
        onValueChange={gererSelection}
        inputValue={saisie}
        onInputValueChange={setSaisie}
        itemToStringLabel={(v: string | null) => options.find((o) => o.value === v)?.label ?? v ?? ''}
        disabled={disabled}
      >
        <Combobox.InputGroup className="relative">
          <Combobox.Input
            id={id}
            placeholder={S.placeholder}
            onBlur={surPerteDeFocus}
            className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 pr-14 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive"
          />
          <div className="absolute inset-y-0 right-1.5 flex items-center gap-0.5">
            <Combobox.Clear
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              aria-label={S.effacer}
            >
              <X className="size-3.5" aria-hidden />
            </Combobox.Clear>
            <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
          </div>
        </Combobox.InputGroup>

        <Combobox.Portal>
          <Combobox.Positioner sideOffset={4} className="z-50 w-(--anchor-width)">
            <Combobox.Popup className="max-h-64 overflow-auto rounded-md border border-border bg-popover py-1 text-popover-foreground">
              <Combobox.Empty className="px-2.5 py-3 text-center text-xs text-muted-foreground">
                {requete.isPending ? S.recherche : S.aucunResultat}
              </Combobox.Empty>
              <Combobox.List>
                {(item: Option) => (
                  <Combobox.Item
                    key={item.value}
                    value={item.value}
                    className="flex cursor-pointer items-center justify-between gap-2 px-2.5 py-1.5 font-mono text-xs data-[highlighted]:bg-brand-subtle data-[highlighted]:text-foreground"
                  >
                    <span className={cn(item.inactif && 'text-muted-foreground')}>{item.label}</span>
                    <Combobox.ItemIndicator>
                      <Check className="size-3.5 shrink-0" aria-hidden />
                    </Combobox.ItemIndicator>
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </div>
  )
}
