import { describe, expect, it } from "vitest";
import { generateDraftHeuristically } from "@/lib/adapters/llm/mock/generate-draft-heuristics";

describe("generateDraftHeuristically (SPEC.md §11)", () => {
  it("fills known field values and leaves no placeholder when everything is known", () => {
    const result = generateDraftHeuristically({
      caseId: "c1",
      category: "CUSTOMER_RECEIVABLE",
      classificationSummary: "Sintesi del credito",
      extractedFieldValues: {
        customer_name: "Rossi Trasporti Srl",
        invoice_number: "FAT-2026-0001",
        invoice_date: "2026-01-01T00:00:00.000Z",
        amount: 1200,
        due_date: "2026-02-01T00:00:00.000Z",
      },
      templateSubject: null,
      templateBody: null,
    });

    expect(result.placeholders).toEqual([]);
    expect(result.needs_human_review).toBe(false);
    expect(result.body_text).not.toContain("DA COMPLETARE");
    expect(result.body_text).toContain("Rossi Trasporti Srl");
    expect(result.subject).toContain("FAT-2026-0001");
  });

  it("never invents missing data: marks it as an evidenziato placeholder", () => {
    const result = generateDraftHeuristically({
      caseId: "c1",
      category: "CLAIM_OR_DAMAGE",
      classificationSummary: null,
      extractedFieldValues: {},
      templateSubject: null,
      templateBody: null,
    });

    expect(result.placeholders.length).toBeGreaterThan(0);
    expect(result.needs_human_review).toBe(true);
    expect(result.body_text).toMatch(/\[\[DA COMPLETARE:.+\]\]/);
    expect(result.body_text).not.toMatch(/undefined|null/i);
  });

  it("uses a provided ReplyTemplate skeleton (from Impostazioni) instead of the default", () => {
    const result = generateDraftHeuristically({
      caseId: "c1",
      category: "OTHER",
      classificationSummary: "Riepilogo personalizzato",
      extractedFieldValues: {},
      templateSubject: "Oggetto personalizzato",
      templateBody: "Corpo: {{summary}}",
    });

    expect(result.subject).toBe("Oggetto personalizzato");
    expect(result.body_text).toBe("Corpo: Riepilogo personalizzato");
  });

  it("never sets a field indicating the draft was sent", () => {
    const result = generateDraftHeuristically({
      caseId: "c1",
      category: "QUOTE_REQUEST",
      classificationSummary: "Richiesta preventivo",
      extractedFieldValues: {},
      templateSubject: null,
      templateBody: null,
    });
    expect(result).not.toHaveProperty("sent");
    expect(result).not.toHaveProperty("sentAt");
  });
});
