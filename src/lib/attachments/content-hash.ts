import { createHash } from "node:crypto";

/**
 * Hash deterministico dei byte grezzi di un allegato (FASE 10, docs/FASE-10-LETTURA-ALLEGATI.md):
 * usato per riusare un'estrazione già riuscita in passato (stesso file, es. fattura duplicata)
 * senza rieseguire alcun parser, mai per identificare/deduplicare pratiche (quello resta
 * esplicitamente un compito umano, SPEC.md §7).
 */
export function computeContentHash(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}
