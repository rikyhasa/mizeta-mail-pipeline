/**
 * Read-only interface to the gestionale (SPEC.md §5, CLAUDE.md invariant 8). Type-only
 * stub in Fase 1 — no implementation exists yet, and nothing in the app calls it. Any
 * future gestionale integration writes only through this interface, and only reads.
 */
export interface ERPAdapter {
  getCustomerByVatNumber(vatNumber: string): Promise<{ id: string; name: string } | null>;
  getInvoicePaymentStatus(
    invoiceNumber: string,
  ): Promise<{ status: "OPEN" | "PAID" | "UNKNOWN"; paidAt: Date | null } | null>;
  healthCheck(): Promise<{ ok: boolean }>;
}
