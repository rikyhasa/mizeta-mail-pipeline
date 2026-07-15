export type FieldTier = "confirmed" | "problematic" | "middle";

/**
 * Tre presentazioni per i dati estratti (Fase 7C): compatta per i campi
 * affidabili, evidente per quelli mancanti o da verificare, sobria per gli
 * altri. Basata solo su dati già caricati, nessuna nuova query.
 */
export function classifyFieldTier(field: {
  value: string | null;
  needsHumanReview: boolean;
  confirmedBy: { name: string } | null;
}): FieldTier {
  if (!field.value || field.needsHumanReview) return "problematic";
  if (field.confirmedBy) return "confirmed";
  return "middle";
}
