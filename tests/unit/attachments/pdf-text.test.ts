import { describe, expect, it } from "vitest";
import { extractPdfText } from "@/lib/attachments/extractors/pdf-text";
import { env } from "@/lib/config/env";

/** Costruisce un PDF minimale ma reale (non un mock): un oggetto Catalog/Pages/Font/Content per
 * pagina, xref con offset reali. pdfjs-dist recupera comunque via scansione se l'xref non è
 * perfetto, ma qui è calcolato correttamente. */
function buildMinimalPdf(pageTexts: string[]): Buffer {
  const catalogId = 1;
  const pagesId = 2;
  const fontId = 3;
  let idCursor = 4;
  const pageIds: number[] = [];
  const contentIds: number[] = [];
  for (let i = 0; i < pageTexts.length; i += 1) {
    pageIds.push(idCursor++);
    contentIds.push(idCursor++);
  }

  const objects: string[] = [];
  const kids = pageIds.map((id) => `${id} 0 R`).join(" ");
  objects.push(`${catalogId} 0 obj\n<< /Type /Catalog /Pages ${pagesId} 0 R >>\nendobj`);
  objects.push(`${pagesId} 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pageTexts.length} >>\nendobj`);
  objects.push(`${fontId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`);

  pageTexts.forEach((text, i) => {
    const pageId = pageIds[i];
    const contentId = contentIds[i];
    objects.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent ${pagesId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> /MediaBox [0 0 300 300] /Contents ${contentId} 0 R >>\nendobj`,
    );
    const streamContent = `BT /F1 12 Tf 10 100 Td (${text}) Tj ET`;
    objects.push(`${contentId} 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj`);
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${obj}\n`;
  }
  const xrefStart = Buffer.byteLength(pdf, "latin1");
  const totalObjs = objects.length + 1;
  pdf += `xref\n0 ${totalObjs}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${totalObjs} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}

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
