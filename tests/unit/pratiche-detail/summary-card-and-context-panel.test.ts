import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

const { SummaryCard } = await import("@/app/(app)/pratiche/[id]/_components/SummaryCard");
const { ContextPanel } = await import("@/app/(app)/pratiche/[id]/_components/ContextPanel");

const SUMMARY_CARD_BASE = {
  caseId: "case-1",
  priority: "NORMAL" as const,
  summary: null,
  confidence: null,
  status: "NEW" as const,
  statusOptions: [{ value: "NEW", label: "Nuova" }],
  assignedToId: null,
  assigneeOptions: [],
  otherDeadlines: [],
  amountFormatted: "€ 0,00",
};

/** FASE 12, Bug 4: la scadenza calcolata di fallback (indicatore ricorso) va sempre mostrata con
 * l'etichetta "(provvisoria)", mai come una data nuda indistinguibile da un termine confermato
 * estratto dal verbale. */
describe("SummaryCard — scadenza provvisoria (FASE 12, Bug 4)", () => {
  it("mostra la data con l'etichetta (provvisoria) quando nextDeadlineProvisional è true", () => {
    const html = renderToStaticMarkup(
      createElement(SummaryCard, { ...SUMMARY_CARD_BASE, nextDeadlineAt: new Date("2026-07-31T00:00:00.000Z"), nextDeadlineProvisional: true }),
    );
    expect(html).toContain("(provvisoria)");
    expect(html).not.toContain("Nessuna scadenza");
  });

  it("non mostra l'etichetta (provvisoria) per una scadenza persistita/confermata", () => {
    const html = renderToStaticMarkup(
      createElement(SummaryCard, { ...SUMMARY_CARD_BASE, nextDeadlineAt: new Date("2026-07-31T00:00:00.000Z"), nextDeadlineProvisional: false }),
    );
    expect(html).not.toContain("(provvisoria)");
  });

  it("mostra ancora 'Nessuna scadenza' quando non c'è alcuna data (nessun fallback disponibile)", () => {
    const html = renderToStaticMarkup(createElement(SummaryCard, { ...SUMMARY_CARD_BASE, nextDeadlineAt: null }));
    expect(html).toContain("Nessuna scadenza");
  });
});

const CONTEXT_PANEL_BASE = {
  partyType: null,
  partyName: null,
  fromName: null,
  fromAddress: null,
  mailboxDisplayName: null,
  mailboxAddress: null,
  department: null,
  receivedAt: null,
  updatedAt: new Date("2026-07-21T00:00:00.000Z"),
  vehicleType: null,
  plate: null,
  driverName: null,
  secondaryCategories: [],
};

/** FASE 12, Bug 6: prima il pannello leggeva solo `needsHumanReview` (case-level), ignorando gli
 * item enforcement pendenti — una pratica poteva mostrare "Nessuna revisione in sospeso" con la
 * verifica autovelox ancora aperta. */
describe("ContextPanel — stato revisione include gli item enforcement (FASE 12, Bug 6)", () => {
  it("mostra 'Revisione necessaria' se enforcementNeedsReview è true, anche con needsHumanReview false", () => {
    const html = renderToStaticMarkup(
      createElement(ContextPanel, { ...CONTEXT_PANEL_BASE, needsHumanReview: false, enforcementNeedsReview: true }),
    );
    expect(html).toContain("Revisione necessaria");
    expect(html).not.toContain("Nessuna revisione in sospeso");
  });

  it("mostra 'Nessuna revisione in sospeso' solo quando entrambi i segnali sono false", () => {
    const html = renderToStaticMarkup(
      createElement(ContextPanel, { ...CONTEXT_PANEL_BASE, needsHumanReview: false, enforcementNeedsReview: false }),
    );
    expect(html).toContain("Nessuna revisione in sospeso");
  });

  it("mostra 'Revisione necessaria' quando solo needsHumanReview è true (comportamento preesistente invariato)", () => {
    const html = renderToStaticMarkup(
      createElement(ContextPanel, { ...CONTEXT_PANEL_BASE, needsHumanReview: true, enforcementNeedsReview: false }),
    );
    expect(html).toContain("Revisione necessaria");
  });
});
