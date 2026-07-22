import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// AppealDecisionForm ("use client") chiama useRouter(): un rendering SSR isolato non ha un
// router montato, va stubbato — stesso approccio già usato in quick-actions-targets.test.ts.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {}, back: () => {} }),
}));

const { SummaryCard } = await import("@/app/(app)/pratiche/[id]/_components/SummaryCard");
const { ContextPanel } = await import("@/app/(app)/pratiche/[id]/_components/ContextPanel");
const { AppealIndicatorCard } = await import("@/app/(app)/pratiche/[id]/_components/AppealIndicatorCard");

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
  enforcementReviewDetail: null,
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

/** FASE 12, Blocco C: quando resta da confermare solo il tipo di dispositivo (i campi
 * tecnici sono già stati verificati dal registro MIT), il dettaglio lo dice con
 * precisione invece del generico "Dati del dispositivo da confermare" — stesso gate,
 * solo un testo più preciso. */
describe("ContextPanel — segnale di revisione preciso (FASE 12, Blocco C)", () => {
  it("mostra il dettaglio quando enforcementNeedsReview è true ed è fornito un testo preciso", () => {
    const html = renderToStaticMarkup(
      createElement(ContextPanel, {
        ...CONTEXT_PANEL_BASE,
        needsHumanReview: false,
        enforcementNeedsReview: true,
        enforcementReviewDetail: "Conferma il tipo di dispositivo — i dati tecnici sono già verificati dal registro MIT",
      }),
    );
    expect(html).toContain("Conferma il tipo di dispositivo — i dati tecnici sono già verificati dal registro MIT");
  });

  it("non mostra alcun dettaglio quando enforcementNeedsReview è false, anche se un testo fosse passato", () => {
    const html = renderToStaticMarkup(
      createElement(ContextPanel, {
        ...CONTEXT_PANEL_BASE,
        needsHumanReview: false,
        enforcementNeedsReview: false,
        enforcementReviewDetail: "Conferma il tipo di dispositivo — i dati tecnici sono già verificati dal registro MIT",
      }),
    );
    expect(html).not.toContain("Conferma il tipo di dispositivo");
  });
});

const APPEAL_RESULT_BASE = {
  documentaryAxis: "NONE" as const,
  documentaryStatus: null,
  economicAxis: null,
  indication: "INSUFFICIENT_DATA" as const,
  valueAtStake: null,
  gdpCost: null,
  breakdown: [],
};

/** FASE 12, Blocco C — P11 (rimandata dal Blocco B): solo fatto/fonte dei parametri
 * economici di input, mai un'affermazione sull'affidabilità del risultato (invariante 9). */
describe("AppealIndicatorCard — riga trasparenza parametri (FASE 12, Blocco C, P11)", () => {
  it("mostra la data di verifica quando appealCostParamsVerifiedAt è valorizzato", () => {
    const html = renderToStaticMarkup(
      createElement(AppealIndicatorCard, {
        caseId: "case-1",
        result: APPEAL_RESULT_BASE,
        decision: null,
        appealCostParamsSource: "D.M. 2024, tabella contributo unificato",
        appealCostParamsVerifiedAt: new Date("2026-01-12T00:00:00.000Z"),
      }),
    );
    expect(html).toContain("Parametri:");
    expect(html).toContain("normativi verificati il 12/01/2026");
    expect(html).toContain("interni non ancora tarati");
  });

  it("mostra 'non ancora verificati' quando appealCostParamsVerifiedAt è null", () => {
    const html = renderToStaticMarkup(
      createElement(AppealIndicatorCard, {
        caseId: "case-1",
        result: APPEAL_RESULT_BASE,
        decision: null,
        appealCostParamsSource: null,
        appealCostParamsVerifiedAt: null,
      }),
    );
    expect(html).toContain("normativi non ancora verificati");
  });

  it("non contiene mai un'affermazione di affidabilità del risultato", () => {
    const html = renderToStaticMarkup(
      createElement(AppealIndicatorCard, {
        caseId: "case-1",
        result: APPEAL_RESULT_BASE,
        decision: null,
        appealCostParamsSource: "fonte",
        appealCostParamsVerifiedAt: new Date("2026-01-12T00:00:00.000Z"),
      }),
    );
    for (const word of ["affidabile", "accurato", "sicuro al", "garantit"]) {
      expect(html.toLowerCase()).not.toContain(word);
    }
  });
});
