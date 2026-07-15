import { describe, expect, it } from "vitest";
import { escapeHtml } from "@/lib/adapters/documents/templates/shared";
import { renderQuoteSheetHtml } from "@/lib/adapters/documents/templates/quote-sheet";
import { renderClaimDossierHtml } from "@/lib/adapters/documents/templates/claim-dossier";
import { renderFineSheetHtml } from "@/lib/adapters/documents/templates/fine-sheet";

describe("escapeHtml", () => {
  it("neutralizza markup potenzialmente pericoloso proveniente dal contenuto email", () => {
    const escaped = escapeHtml('<script>alert("x")</script>');
    expect(escaped).not.toContain("<script>");
    expect(escaped).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });
});

const CASE_INFO = { reference: "PRT-2026-0001", title: "Test", customerName: "Cliente SRL", supplierName: null, createdAt: new Date("2026-01-01") };

describe("template scheda preventivo", () => {
  it("include i campi valorizzati ed escapa i valori pericolosi", () => {
    const html = renderQuoteSheetHtml(CASE_INFO, [
      { fieldKey: "customer_name", value: '<img src=x onerror=alert(1)>', needsHumanReview: false },
      { fieldKey: "pallet_count", value: "12", needsHumanReview: true },
    ]);
    expect(html).toContain("Scheda preventivo");
    expect(html).toContain("PRT-2026-0001");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("da verificare");
  });

  it("mostra un placeholder per i campi mancanti, mai un dato inventato", () => {
    const html = renderQuoteSheetHtml(CASE_INFO, []);
    expect(html).toContain("—");
  });
});

describe("template dossier reclamo", () => {
  it("renderizza i campi della categoria CLAIM_OR_DAMAGE", () => {
    const html = renderClaimDossierHtml(CASE_INFO, [{ fieldKey: "damage_description", value: "Merce danneggiata", needsHumanReview: false }]);
    expect(html).toContain("Dossier reclamo");
    expect(html).toContain("Merce danneggiata");
  });
});

describe("template scheda multa", () => {
  it("renderizza i campi della categoria FINE_OR_PENALTY", () => {
    const html = renderFineSheetHtml(CASE_INFO, [{ fieldKey: "notice_number", value: "V-12345", needsHumanReview: false }]);
    expect(html).toContain("Scheda multa");
    expect(html).toContain("V-12345");
  });
});
