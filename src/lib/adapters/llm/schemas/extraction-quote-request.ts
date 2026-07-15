import { z } from "zod";
import { extractedField, extractedStringField, extractedNumberField, extractedBooleanField } from "./extraction-common";

const TRANSPORT_MODE_VALUES = ["GROUPAGE", "LTL", "FTL", "LAST_MILE"] as const;

/** Estrazione campi per QUOTE_REQUEST (SPEC.md §6). */
export const quoteRequestExtractionSchema = z.object({
  customer_name: extractedStringField,
  contact_name: extractedStringField,
  contact_email: extractedStringField,
  contact_phone: extractedStringField,
  pickup_location: extractedStringField,
  delivery_location: extractedStringField,
  pickup_datetime: extractedStringField,
  pickup_time_window: extractedStringField,
  delivery_datetime: extractedStringField,
  delivery_time_window: extractedStringField,
  pallet_count: extractedNumberField,
  weight_kg: extractedNumberField,
  volume_m3: extractedNumberField,
  linear_meters: extractedNumberField,
  goods_type: extractedStringField,
  transport_mode: extractedField(z.enum(TRANSPORT_MODE_VALUES)),
  requested_vehicle: extractedStringField,
  hydraulic_tailgate_required: extractedBooleanField,
  adr_required: extractedBooleanField,
  temperature_controlled: extractedBooleanField,
  goods_value: extractedNumberField,
  insurance_required: extractedBooleanField,
  requested_or_proposed_price: extractedNumberField,
  response_due_at: extractedStringField,
  missing_data: z.array(z.string()),
});

export type QuoteRequestExtraction = z.infer<typeof quoteRequestExtractionSchema>;

/**
 * Split per il provider Anthropic (verificato con chiamate reali dirette, non solo teoria): lo
 * schema completo supera il limite di complessità dello Structured Output se inviato in un'unica
 * chiamata. La causa reale non è il numero di campi in sé (13 campi stringa insieme passano) ma
 * la combinazione di più tipi "unici" (enum/array, non condivisi come extractedStringField) nella
 * stessa chiamata — anche solo 2 tipi unici insieme fanno esplodere il costo di compilazione. Le
 * parti qui sotto raggruppano per tipo condiviso (stringhe insieme, numeri insieme) e isolano
 * l'unico campo enum (`transport_mode`) — `missing_data` non è avvolto in extractedField quindi
 * può stare ovunque. Il provider mock non è soggetto a questo limite e resta invariato.
 */
export const quoteRequestExtractionSchemaPart1 = quoteRequestExtractionSchema.pick({
  customer_name: true,
  contact_name: true,
  contact_email: true,
  contact_phone: true,
  pickup_location: true,
  delivery_location: true,
  pickup_datetime: true,
  pickup_time_window: true,
  delivery_datetime: true,
  delivery_time_window: true,
  goods_type: true,
  requested_vehicle: true,
  response_due_at: true,
});

export const quoteRequestExtractionSchemaPart2 = quoteRequestExtractionSchema.pick({
  pallet_count: true,
  weight_kg: true,
  volume_m3: true,
  linear_meters: true,
  goods_value: true,
  requested_or_proposed_price: true,
});

export const quoteRequestExtractionSchemaPart3 = quoteRequestExtractionSchema.pick({
  hydraulic_tailgate_required: true,
  adr_required: true,
  temperature_controlled: true,
  insurance_required: true,
  transport_mode: true,
  missing_data: true,
});
