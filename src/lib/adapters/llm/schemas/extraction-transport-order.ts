import { z } from "zod";
import { extractedField, extractedStringField, extractedNumberField } from "./extraction-common";

/** Estrazione campi per TRANSPORT_ORDER (SPEC.md §6). */
export const transportOrderExtractionSchema = z.object({
  order_number: extractedStringField,
  customer_name: extractedStringField,
  customer_references: extractedField(z.array(z.string())),
  origin: extractedStringField,
  destination: extractedStringField,
  pickup_datetime: extractedStringField,
  pickup_time_window: extractedStringField,
  delivery_datetime: extractedStringField,
  delivery_time_window: extractedStringField,
  vehicle_type: extractedStringField,
  plate: extractedStringField,
  driver_name: extractedStringField,
  price: extractedNumberField,
  instructions: extractedStringField,
  required_documents: extractedField(z.array(z.string())),
  loading_references: extractedStringField,
  unloading_references: extractedStringField,
});

export type TransportOrderExtraction = z.infer<typeof transportOrderExtractionSchema>;

/** Split per il provider Anthropic — vedi extraction-quote-request.ts per il motivo (17 campi > limite ~16). */
export const transportOrderExtractionSchemaPart1 = transportOrderExtractionSchema.pick({
  order_number: true,
  customer_name: true,
  customer_references: true,
  origin: true,
  destination: true,
  pickup_datetime: true,
  pickup_time_window: true,
  delivery_datetime: true,
  delivery_time_window: true,
});

export const transportOrderExtractionSchemaPart2 = transportOrderExtractionSchema.pick({
  vehicle_type: true,
  plate: true,
  driver_name: true,
  price: true,
  instructions: true,
  required_documents: true,
  loading_references: true,
  unloading_references: true,
});
