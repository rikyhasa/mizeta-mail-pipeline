import { z } from "zod";
import { extractedStringField, extractedNumberField, extractedBooleanField } from "./extraction-common";

/**
 * Estrazione campi per SUPPLIER_INVOICE (SPEC.md §6). `possible_duplicate` è sempre `false`
 * quando prodotto dal modello: viene sovrascritto server-side dal motore di matching (livello
 * numero fattura, SPEC.md §7) — mai deciso autonomamente dall'LLM.
 */
export const supplierInvoiceExtractionSchema = z.object({
  supplier_name: extractedStringField,
  vat_number: extractedStringField,
  invoice_number: extractedStringField,
  invoice_date: extractedStringField,
  amount_net: extractedNumberField,
  vat_amount: extractedNumberField,
  amount_total: extractedNumberField,
  currency: extractedStringField,
  due_date: extractedStringField,
  iban: extractedStringField,
  order_number: extractedStringField,
  linked_shipment_reference: extractedStringField,
  plate: extractedStringField,
  cost_center: extractedStringField,
  possible_duplicate: extractedBooleanField,
  anomaly_reason: extractedStringField,
});

export type SupplierInvoiceExtraction = z.infer<typeof supplierInvoiceExtractionSchema>;

/**
 * Split per il provider Anthropic — 16 campi è esattamente al limite empirico osservato (unico
 * schema a 16 campi che è passato nel confronto reale); si divide comunque per lasciare margine.
 */
export const supplierInvoiceExtractionSchemaPart1 = supplierInvoiceExtractionSchema.pick({
  supplier_name: true,
  vat_number: true,
  invoice_number: true,
  invoice_date: true,
  amount_net: true,
  vat_amount: true,
  amount_total: true,
  currency: true,
});

export const supplierInvoiceExtractionSchemaPart2 = supplierInvoiceExtractionSchema.pick({
  due_date: true,
  iban: true,
  order_number: true,
  linked_shipment_reference: true,
  plate: true,
  cost_center: true,
  possible_duplicate: true,
  anomaly_reason: true,
});
