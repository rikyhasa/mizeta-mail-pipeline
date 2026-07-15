import type { z } from "zod";
import type { CaseCategory } from "@/generated/prisma/enums";
import {
  quoteRequestExtractionSchema,
  quoteRequestExtractionSchemaPart1,
  quoteRequestExtractionSchemaPart2,
  quoteRequestExtractionSchemaPart3,
} from "./extraction-quote-request";
import {
  transportOrderExtractionSchema,
  transportOrderExtractionSchemaPart1,
  transportOrderExtractionSchemaPart2,
} from "./extraction-transport-order";
import {
  supplierInvoiceExtractionSchema,
  supplierInvoiceExtractionSchemaPart1,
  supplierInvoiceExtractionSchemaPart2,
} from "./extraction-supplier-invoice";
import { customerReceivableExtractionSchema } from "./extraction-customer-receivable";
import {
  finePenaltyExtractionSchema,
  finePenaltyExtractionSchemaPart1,
  finePenaltyExtractionSchemaPart2,
  finePenaltyExtractionSchemaPart3,
  finePenaltyExtractionSchemaPart4,
} from "./extraction-fine-or-penalty";
import {
  claimOrDamageExtractionSchema,
  claimOrDamageExtractionSchemaPart1,
  claimOrDamageExtractionSchemaPart2,
  claimOrDamageExtractionSchemaPart3,
  claimOrDamageExtractionSchemaPart4,
} from "./extraction-claim-or-damage";

/**
 * Dispatch schema di estrazione per categoria (SPEC.md §6, priorità di implementazione). Le
 * altre 6 categorie (PAYMENT_NOTICE, TRANSPORT_DOCUMENT, CUSTOMER_COMMUNICATION,
 * ADMINISTRATIVE, OTHER, UNCERTAIN) non compaiono qui: ricevono solo classificazione + sintesi.
 */
export const EXTRACTION_SCHEMA_BY_CATEGORY = {
  QUOTE_REQUEST: quoteRequestExtractionSchema,
  TRANSPORT_ORDER: transportOrderExtractionSchema,
  SUPPLIER_INVOICE: supplierInvoiceExtractionSchema,
  CUSTOMER_RECEIVABLE: customerReceivableExtractionSchema,
  FINE_OR_PENALTY: finePenaltyExtractionSchema,
  CLAIM_OR_DAMAGE: claimOrDamageExtractionSchema,
} as const;

export type ExtractableCategory = keyof typeof EXTRACTION_SCHEMA_BY_CATEGORY;

export function isExtractableCategory(category: CaseCategory): category is ExtractableCategory {
  return category in EXTRACTION_SCHEMA_BY_CATEGORY;
}

export type ExtractionResultFor<C extends ExtractableCategory> = z.infer<(typeof EXTRACTION_SCHEMA_BY_CATEGORY)[C]>;

export function extractionSchemaForCategory<C extends ExtractableCategory>(category: C) {
  return EXTRACTION_SCHEMA_BY_CATEGORY[category];
}

/**
 * Alcuni schemi superano il limite empirico di complessità dello Structured Output di Anthropic
 * se inviati in un'unica chiamata (verificato con chiamate reali dirette, non solo teoria — vedi
 * commenti nei singoli file di schema). La causa non è il numero di campi ma la combinazione di
 * più tipi "unici" (enum/array, non condivisi) nella stessa chiamata. `AnthropicLLMProvider.
 * extractFields()` itera questo elenco di sotto-schemi (1 solo elemento = nessuno split
 * necessario) e unisce i risultati; ri-valida sempre il merge contro lo schema completo. Il
 * provider mock non è soggetto a questo limite e resta invariato.
 */
export const EXTRACTION_SCHEMA_PARTS_BY_CATEGORY: {
  [C in ExtractableCategory]: readonly [z.ZodTypeAny, ...z.ZodTypeAny[]];
} = {
  QUOTE_REQUEST: [quoteRequestExtractionSchemaPart1, quoteRequestExtractionSchemaPart2, quoteRequestExtractionSchemaPart3],
  TRANSPORT_ORDER: [transportOrderExtractionSchemaPart1, transportOrderExtractionSchemaPart2],
  SUPPLIER_INVOICE: [supplierInvoiceExtractionSchemaPart1, supplierInvoiceExtractionSchemaPart2],
  CUSTOMER_RECEIVABLE: [customerReceivableExtractionSchema],
  FINE_OR_PENALTY: [
    finePenaltyExtractionSchemaPart1,
    finePenaltyExtractionSchemaPart2,
    finePenaltyExtractionSchemaPart3,
    finePenaltyExtractionSchemaPart4,
  ],
  CLAIM_OR_DAMAGE: [
    claimOrDamageExtractionSchemaPart1,
    claimOrDamageExtractionSchemaPart2,
    claimOrDamageExtractionSchemaPart3,
    claimOrDamageExtractionSchemaPart4,
  ],
};
