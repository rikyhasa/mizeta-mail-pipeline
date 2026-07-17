"use client";

import { Printer } from "lucide-react";
import { buttonClassName } from "@/components/ui/Button";

/** "Stampa" (reference): `window.print()` nativo del browser — nessuna generazione lato
 * server, quindi nessun endpoint nuovo. Nascosto dalla stampa stessa (`print:hidden`). */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={`${buttonClassName({ variant: "secondary", size: "md" })} print:hidden`}>
      <Printer className="h-4 w-4" aria-hidden="true" />
      Stampa
    </button>
  );
}
