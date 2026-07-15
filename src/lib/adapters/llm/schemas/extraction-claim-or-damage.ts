import { z } from "zod";
import { extractedField, extractedStringField, extractedNumberField, extractedBooleanField } from "./extraction-common";

const SEVERITY_VALUES = ["LOW", "MEDIUM", "HIGH"] as const;

/** Estrazione campi per CLAIM_OR_DAMAGE (SPEC.md §6). */
export const claimOrDamageExtractionSchema = z.object({
  customer_name: extractedStringField,
  shipment_or_trip_reference: extractedStringField,
  event_date: extractedStringField,
  goods_description: extractedStringField,
  damage_description: extractedStringField,
  requested_amount: extractedNumberField,
  photos_present: extractedBooleanField,
  cmr_or_pod_present: extractedBooleanField,
  insurance_involved: extractedBooleanField,
  severity: extractedField(z.enum(SEVERITY_VALUES)),
  response_due_at: extractedStringField,
  missing_documents: extractedField(z.array(z.string())),
  possible_responsible_party: extractedStringField,
});

export type ClaimOrDamageExtraction = z.infer<typeof claimOrDamageExtractionSchema>;

/**
 * Split per il provider Anthropic (verificato con chiamate reali dirette): questo schema (13
 * campi, sotto il limite di 16) fallisce comunque perché combina DUE tipi "unici" (severity enum
 * + missing_documents array) nella stessa chiamata — verificato che ciascuno dei due, isolato,
 * passa da solo, mentre insieme (anche con solo 6 campi totali) fanno esplodere il costo di
 * compilazione. Vedi extraction-quote-request.ts per lo stesso pattern.
 */
export const claimOrDamageExtractionSchemaPart1 = claimOrDamageExtractionSchema.pick({
  customer_name: true,
  shipment_or_trip_reference: true,
  event_date: true,
  goods_description: true,
  damage_description: true,
  response_due_at: true,
  possible_responsible_party: true,
});

export const claimOrDamageExtractionSchemaPart2 = claimOrDamageExtractionSchema.pick({
  requested_amount: true,
  photos_present: true,
  cmr_or_pod_present: true,
  insurance_involved: true,
});

export const claimOrDamageExtractionSchemaPart3 = claimOrDamageExtractionSchema.pick({
  severity: true,
});

export const claimOrDamageExtractionSchemaPart4 = claimOrDamageExtractionSchema.pick({
  missing_documents: true,
});
