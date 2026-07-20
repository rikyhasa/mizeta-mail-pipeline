import { describe, expect, it } from "vitest";
import { extractPdfText } from "@/lib/attachments/extractors/pdf-text";
import { env } from "@/lib/config/env";
import { buildMinimalPdf } from "../../helpers/build-minimal-pdf";

describe("extractPdfText", () => {
  it("estrae il testo per pagina di un PDF reale multi-pagina, con source_page corretto", async () => {
    const pdf = buildMinimalPdf(["Prima pagina di test", "Seconda pagina con testo diverso"]);
    const { outcome } = await extractPdfText(pdf, pdf.length);
    expect(outcome.status).toBe("SUCCEEDED");
    if (outcome.status !== "SUCCEEDED" || outcome.method !== "LOCAL_TEXT") throw new Error("atteso LOCAL_TEXT");
    expect(outcome.pageCount).toBe(2);
    expect(outcome.pages).toEqual([
      { page: 1, text: "Prima pagina di test" },
      { page: 2, text: "Seconda pagina con testo diverso" },
    ]);
  });

  it("fixture mock/seed: mimeType dichiara PDF ma i byte sono già testo semplice — trattato come testo pronto, mai un tentativo di parsing PDF", async () => {
    const fakeContent = Buffer.from("FATTURA FAT-2026-1001 - AutoService - Totale 1464.00 EUR - Scadenza 28/07/2026", "utf-8");
    const { outcome, needsVisionFallback } = await extractPdfText(fakeContent, fakeContent.length);
    expect(needsVisionFallback).toBe(false);
    expect(outcome).toEqual({
      status: "SUCCEEDED",
      method: "LOCAL_TEXT",
      pages: [{ page: 1, text: fakeContent.toString("utf-8") }],
      pageCount: 1,
      extractionCostUsd: null,
    });
  });

  it("un allegato vuoto (byte assenti/corrotti) fallisce, non un successo con testo vuoto", async () => {
    const { outcome } = await extractPdfText(Buffer.alloc(0), 0);
    expect(outcome.status).toBe("FAILED");
  });

  it("un file %PDF- ma strutturalmente corrotto fallisce in modo pulito", async () => {
    const corrupted = Buffer.from("%PDF-1.4\nnon è una struttura PDF valida, solo testo a caso dopo l'intestazione", "utf-8");
    const { outcome, needsVisionFallback } = await extractPdfText(corrupted, corrupted.length);
    expect(outcome.status).toBe("FAILED");
    expect(needsVisionFallback).toBe(true);
  });

  it("un PDF reale ma con pochissimo testo (scansione) segnala il fallback a visione", async () => {
    const pdf = buildMinimalPdf(["x"]);
    const { needsVisionFallback } = await extractPdfText(pdf, pdf.length);
    expect(needsVisionFallback).toBe(true);
  });

  it("oltre il limite di dimensione: hard skip, mai un tentativo di parsing", async () => {
    const pdf = buildMinimalPdf(["contenuto"]);
    const oversized = env.ATTACHMENT_EXTRACTION_MAX_SIZE_BYTES + 1;
    const { outcome } = await extractPdfText(pdf, oversized);
    expect(outcome.status).toBe("FAILED");
    if (outcome.status !== "FAILED") throw new Error("atteso FAILED");
    expect(outcome.reason).toContain("dimensione");
  });

  it("oltre il limite di pagine: estrazione parziale delle prime N, mai un rifiuto totale", async () => {
    const originalMax = env.ATTACHMENT_EXTRACTION_MAX_PAGES;
    (env as { ATTACHMENT_EXTRACTION_MAX_PAGES: number }).ATTACHMENT_EXTRACTION_MAX_PAGES = 1;
    try {
      const pdf = buildMinimalPdf(["Prima pagina con abbastanza testo da superare la soglia di densità", "Seconda pagina anch'essa con testo a sufficienza"]);
      const { outcome } = await extractPdfText(pdf, pdf.length);
      expect(outcome.status).toBe("SUCCEEDED");
      if (outcome.status !== "SUCCEEDED" || outcome.method !== "LOCAL_TEXT") throw new Error("atteso LOCAL_TEXT");
      expect(outcome.pageCount).toBe(2); // totale pagine reali del documento
      expect(outcome.pages).toHaveLength(1); // ma solo la prima è stata elaborata
      expect(outcome.partialNote).toBeTruthy();
    } finally {
      (env as { ATTACHMENT_EXTRACTION_MAX_PAGES: number }).ATTACHMENT_EXTRACTION_MAX_PAGES = originalMax;
    }
  });
});
