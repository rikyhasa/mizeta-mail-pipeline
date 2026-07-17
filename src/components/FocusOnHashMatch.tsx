"use client";

import { useEffect } from "react";

/**
 * Sposta il focus sull'elemento `id` quando il fragment della pagina corrisponde esattamente:
 * completa il comportamento nativo del browser, che scorre alla vista un elemento già visibile
 * ma non gli sposta il focus (a differenza di un campo dentro un `<details>` chiuso, che il
 * browser rivela e focalizza da solo — docs/UX-AUDIT-2026-07.md, punto 3.3.5).
 */
export function FocusOnHashMatch({ id }: { id: string }) {
  useEffect(() => {
    if (window.location.hash === `#${id}`) {
      document.getElementById(id)?.focus();
    }
  }, [id]);

  return null;
}
