import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { LIBELLES } from "@/libelles/fr"

/**
 * Champ mot de passe avec bascule de visibilité.
 *
 * Le bouton reste dans l'ordre de tabulation naturel (pas de tabIndex={-1}) : un agent au
 * clavier doit pouvoir l'atteindre comme n'importe quel autre contrôle.
 */
function InputMotDePasse({ className, ...props }: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = React.useState(false)

  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className={cn("pr-9", className)} {...props} />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute inset-y-0 right-0.5 my-auto text-muted-foreground hover:text-foreground"
        aria-label={visible ? LIBELLES.champMotDePasse.masquer : LIBELLES.champMotDePasse.afficher}
        aria-pressed={visible}
        onClick={() => setVisible((etat) => !etat)}
      >
        {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
      </Button>
    </div>
  )
}

export { InputMotDePasse }
