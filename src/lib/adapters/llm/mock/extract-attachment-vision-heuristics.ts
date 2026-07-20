import { detectSecurityFlags } from "@/lib/adapters/llm/mock/security-flags";
import type { AttachmentVisionExtractionInput } from "@/lib/adapters/llm/types";
import type { AttachmentVisionExtractionResult } from "@/lib/adapters/llm/schemas/attachment-vision-extraction";

/** Percentuale minima di caratteri stampabili perché i byte decodificati siano considerati testo
 * plausibile (euristica grezza, sufficiente solo per i test/fixture di questo motore mock). */
const PRINTABLE_RATIO_THRESHOLD = 0.85;

function isPlausibleText(text: string): boolean {
  if (text.length === 0) return false;
  let printable = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === 0xfffd) continue; // carattere di sostituzione UTF-8: byte non decodificabili
    if (code >= 0x20 || ch === "\n" || ch === "\t" || ch === "\r") printable += 1;
  }
  return printable / text.length >= PRINTABLE_RATIO_THRESHOLD;
}

/**
 * Motore euristico reale per il livello 3 (visione) in modalità mock (SPEC.md §4, FASE 10):
 * costo zero, nessuna chiamata esterna. Il motore mock non ha capacità di visione reale, quindi
 * non finge di leggere un'immagine: se i byte forniti sono in realtà già testo semplice (stesso
 * pattern delle fixture mock/seed per gli altri livelli), lo trascrive e lo scansiona per
 * pattern di injection; altrimenti restituisce un placeholder esplicitamente etichettato, mai un
 * testo inventato.
 */
export function extractAttachmentVisionHeuristically(input: AttachmentVisionExtractionInput): AttachmentVisionExtractionResult {
  const decoded = Buffer.from(input.contentBase64, "base64").toString("utf-8");

  if (isPlausibleText(decoded)) {
    return { pages: [{ page_number: 1, text: decoded }], security_flags: detectSecurityFlags(decoded) };
  }

  return {
    pages: [{ page_number: 1, text: `[mock-vision] contenuto immagine non analizzabile in modalità mock (${input.fileName})` }],
    security_flags: [],
  };
}
