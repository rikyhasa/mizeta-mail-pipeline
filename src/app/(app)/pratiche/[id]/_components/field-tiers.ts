import type { FieldSourceType } from "@/generated/prisma/enums";

export type FieldTier = "confirmed" | "problematic" | "middle";

export interface CaseFieldData {
  fieldKey: string;
  value: string | null;
  confidence: number | null;
  needsHumanReview: boolean;
  confirmedBy: { name: string } | null;
  sourceType: FieldSourceType | null;
  sourceMessageId: string | null;
  sourceAttachmentId: string | null;
}

export interface TieredField {
  key: string;
  field: CaseFieldData;
  tier: FieldTier;
}

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

/** Ordina e classifica i campi in un'unica lista nell'ordine naturale della categoria
 * (FASE 8B, iterazione 3): tutti i campi — mancanti, da verificare, confermati — condividono
 * la stessa griglia compatta, come `.field-list` nella reference. Il tier resta per la sola
 * differenziazione visiva dentro la cella (badge/valore), non per separare i campi in liste
 * distinte. Calcolo unico, condiviso da ExtractedFieldsSection e dai blocker in page.tsx. */
export function tierFields(fields: CaseFieldData[], fieldOrder: string[]): TieredField[] {
  const fieldsByKey = new Map(fields.map((f) => [f.fieldKey, f]));
  const orderedKeys = [...fieldOrder, ...fields.map((f) => f.fieldKey).filter((k) => !fieldOrder.includes(k))];
  return orderedKeys
    .map((key) => {
      const field = fieldsByKey.get(key);
      return field ? { key, field, tier: classifyFieldTier(field) } : null;
    })
    .filter((f): f is TieredField => f !== null);
}
