import { z } from "zod";
import { extractedStringField, extractedNumberField, extractedBooleanField } from "./extraction-common";

/**
 * Estrazione campi per CUSTOMER_RECEIVABLE (SPEC.md §6). `erp_verified_status` NON compare in
 * questo schema: non ha senso chiedere al modello uno stato che non può conoscere. Viene
 * sintetizzato server-side (persist-extraction.ts) come CaseField sourceType SYSTEM, sempre
 * null/sconosciuto finché ERPAdapter non è implementato — coerente con CLAUDE.md invariante 4
 * (mai considerare un pagamento incassato sulla sola base di email o contabile).
 */
export const customerReceivableExtractionSchema = z.object({
  customer_name: extractedStringField,
  invoice_number: extractedStringField,
  amount: extractedNumberField,
  invoice_date: extractedStringField,
  due_date: extractedStringField,
  days_overdue: extractedNumberField,
  payment_promise: extractedBooleanField,
  payment_promise_date: extractedStringField,
  has_payment_receipt_attachment: extractedBooleanField,
  customer_declared_status: extractedStringField,
});

export type CustomerReceivableExtraction = z.infer<typeof customerReceivableExtractionSchema>;
