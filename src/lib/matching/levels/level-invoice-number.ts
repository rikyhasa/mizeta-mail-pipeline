import { findInvoiceNumber } from "@/lib/text/patterns";
import type { CaseRepository, MatchEmailInput } from "../types";

/**
 * Livello "numero fattura" (SPEC.md §7). Se la pratica ESISTENTE trovata per numero fattura è a
 * sua volta una SUPPLIER_INVOICE, il nuovo messaggio è quasi certamente un invio duplicato
 * (stessa fattura ricevuta due volte) e NON deve fondersi automaticamente: confidenza
 * volutamente sotto la soglia di auto-link, così l'orchestratore crea una nuova pratica e la
 * mette in coda "possibili duplicati" (§7: mai unire automaticamente a bassa confidenza). La
 * decisione si basa sulla categoria della pratica TROVATA, non su quella del nuovo messaggio:
 * la classificazione del nuovo messaggio può sbagliare/essere incerta, ma se la pratica esistente
 * è già una fattura fornitore il rischio di duplicato resta lo stesso. Per ogni altra categoria
 * di pratica esistente (es. un credito cliente, una conferma contabile) l'associazione è invece
 * corretta e ad alta confidenza.
 */
export async function levelInvoiceNumber(input: MatchEmailInput, repo: CaseRepository) {
  const invoiceNumber = findInvoiceNumber(`${input.subject}\n${input.bodyText}`);
  if (!invoiceNumber) return null;
  const found = await repo.findCaseByInvoiceNumber(invoiceNumber);
  if (!found) return null;

  const confidence = found.category === "SUPPLIER_INVOICE" ? 0.6 : 0.9;
  return { caseId: found.caseId, confidence, level: "invoice_number" as const };
}
