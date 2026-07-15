import type { CaseCategory } from "@/generated/prisma/enums";

/** FieldKey dell'importo principale per categoria, usato per KPI e colonna "importo" della tabella. */
export const AMOUNT_FIELD_BY_CATEGORY: Partial<Record<CaseCategory, string>> = {
  QUOTE_REQUEST: "requested_or_proposed_price",
  TRANSPORT_ORDER: "price",
  SUPPLIER_INVOICE: "amount_total",
  CUSTOMER_RECEIVABLE: "amount",
  FINE_OR_PENALTY: "amount",
  CLAIM_OR_DAMAGE: "requested_amount",
};

export function parseFieldNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
