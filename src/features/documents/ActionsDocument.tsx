import { useMutation } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useAPermission } from '@/features/auth/useProfil'
import { ouvrirPdf, regenererDocument, telechargerDocument, type DocumentRef } from '@/features/documents/api'
import { messageDocument } from '@/features/documents/erreurs'
import { messageRefus } from '@/features/epargne/api'
import { LIBELLES } from '@/libelles/fr'

const D = LIBELLES.documents

/**
 * Actions sur le document d'une opération qui vient de réussir : le PDF archivé par le serveur est
 * récupéré (avec le jeton) puis ouvert pour impression ou enregistrement.
 *
 *  - référence `ok` et droit `documents.read` : « Télécharger / Imprimer » ;
 *  - référence `echec` : message + « Régénérer » (l'opération est enregistrée, jamais bloquée) ;
 *  - référence absente ou droit manquant : message seul — le PDF du serveur est la seule pièce.
 */
export function ActionsDocument({
  reference,
  objet,
}: {
  reference: DocumentRef | null | undefined
  /** « recu », « bon » ou « lettre » : libellé du bouton. */
  objet: 'recu' | 'bon' | 'lettre'
}) {
  const peutLire = useAPermission('documents.read')
  // La référence peut être remplacée par une régénération réussie.
  const [regeneree, setRegeneree] = useState<DocumentRef | null>(null)
  const courante = regeneree ?? reference ?? null

  const ouverture = useMutation({
    mutationFn: async (document: DocumentRef) => {
      const pdf = await telechargerDocument(document.id)
      ouvrirPdf(pdf, document.nom)
    },
  })
  const regeneration = useMutation({
    mutationFn: (document: DocumentRef) => regenererDocument(document.id),
    onSuccess: (nouvelle) => setRegeneree(nouvelle),
  })

  const libelle = {
    recu: D.telechargerImprimerRecu,
    bon: D.telechargerImprimerBon,
    lettre: D.telechargerLettre,
  }[objet]

  if (courante && courante.statut === 'ok' && peutLire) {
    return (
      <div className="space-y-2">
        <Button variant="outline" disabled={ouverture.isPending} onClick={() => ouverture.mutate(courante)}>
          <Printer className="mr-1 size-4" />
          {ouverture.isPending ? D.preparation : libelle}
        </Button>
        {ouverture.isError && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{messageDocument(ouverture.error, D.ouvertureEchec)}</AlertDescription>
          </Alert>
        )}
      </div>
    )
  }

  const enEchec = courante !== null && courante.statut === 'echec' && peutLire
  const message = enEchec ? D.generationEchec : D.documentAbsent
  return (
    <div className="space-y-2">
      <Alert role="status">
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      {enEchec && (
        <Button
          variant="outline"
          disabled={regeneration.isPending}
          onClick={() => regeneration.mutate(courante)}
        >
          {regeneration.isPending ? D.regenerationEnCours : D.regenerer}
        </Button>
      )}
      {regeneration.isError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{messageRefus(regeneration.error, D.regenerationEchec)}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
