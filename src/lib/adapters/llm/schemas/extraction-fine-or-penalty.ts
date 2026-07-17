import { z } from "zod";
import { extractedField, extractedStringField, extractedNumberField } from "./extraction-common";

const RECEIVED_CHANNEL_VALUES = ["PEC", "ORDINARY"] as const;

/** Estrazione campi per FINE_OR_PENALTY (SPEC.md §6). */
export const finePenaltyExtractionSchema = z.object({
  issuing_authority: extractedStringField,
  notice_number: extractedStringField,
  plate: extractedStringField,
  driver_name: extractedStringField,
  violation_datetime: extractedStringField,
  violation_location: extractedStringField,
  violation_type: extractedStringField,
  amount: extractedNumberField,
  reduced_amount: extractedNumberField,
  reduced_payment_due_at: extractedStringField,
  ordinary_payment_due_at: extractedStringField,
  appeal_due_at: extractedStringField,
  /** Data di notifica del verbale (docs/SPEC.md §10bis, indicatore ricorso): base dei termini
   * calcolati GdP/Prefetto in src/lib/appeal-indicator/deadlines.ts — mai la data di infrazione. */
  notification_date: extractedStringField,
  points: extractedNumberField,
  missing_documents: extractedField(z.array(z.string())),
  received_channel: extractedField(z.enum(RECEIVED_CHANNEL_VALUES)),
});

export type FinePenaltyExtraction = z.infer<typeof finePenaltyExtractionSchema>;

/**
 * Split per il provider Anthropic (verificato con chiamate reali dirette): la causa reale non è
 * il numero di campi ma la combinazione di più tipi "unici" (enum/array) nella stessa chiamata —
 * `missing_documents` (array) e `received_channel` (enum) vanno isolati ciascuno nella propria
 * chiamata. Vedi extraction-quote-request.ts per lo stesso pattern.
 */
export const finePenaltyExtractionSchemaPart1 = finePenaltyExtractionSchema.pick({
  issuing_authority: true,
  notice_number: true,
  plate: true,
  driver_name: true,
  violation_datetime: true,
  violation_location: true,
  violation_type: true,
  reduced_payment_due_at: true,
  ordinary_payment_due_at: true,
  appeal_due_at: true,
  notification_date: true,
});

export const finePenaltyExtractionSchemaPart2 = finePenaltyExtractionSchema.pick({
  amount: true,
  reduced_amount: true,
  points: true,
});

export const finePenaltyExtractionSchemaPart3 = finePenaltyExtractionSchema.pick({
  missing_documents: true,
});

export const finePenaltyExtractionSchemaPart4 = finePenaltyExtractionSchema.pick({
  received_channel: true,
});
