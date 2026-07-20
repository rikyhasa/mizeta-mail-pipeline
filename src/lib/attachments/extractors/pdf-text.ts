import { env } from "@/lib/config/env";
import type { AttachmentExtractionOutcome } from "@/lib/attachments/types";

export interface PdfTextExtractionResult {
  outcome: AttachmentExtractionOutcome;
  /** true se il testo estratto è troppo scarso (probabile scansione senza livello testo, o
   * PDF non apribile) — l'orchestratore deve tentare il livello visione; se anche quello
   * fallisce/è rinviato, resta comunque disponibile il risultato di questo livello (mai
   * perdere dati già estratti). */
  needsVisionFallback: boolean;
}

const PDF_MAGIC = "%PDF-";

function isRealPdf(content: Buffer): boolean {
  return content.subarray(0, PDF_MAGIC.length).toString("latin1") === PDF_MAGIC;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

async function extractRealPdfPages(content: Buffer): Promise<{ pages: { page: number; text: string }[]; totalPageCount: number; partial: boolean }> {
  // Build legacy (Node, senza DOM) di pdfjs-dist: unica build che gira fuori da un browser.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(content), verbosity: pdfjs.VerbosityLevel.ERRORS });
  try {
    const doc = await loadingTask.promise;
    const totalPageCount = doc.numPages;
    const pagesToRead = Math.min(totalPageCount, env.ATTACHMENT_EXTRACTION_MAX_PAGES);
    const pages: { page: number; text: string }[] = [];
    for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      // Solo estrazione testo (nessun rendering, nessuna esecuzione di JavaScript/azioni
      // embedded nel PDF — CLAUDE.md invariante 2).
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item) => ("str" in item ? item.str : "")).join(" ");
      pages.push({ page: pageNumber, text });
    }
    return { pages, totalPageCount, partial: totalPageCount > pagesToRead };
  } finally {
    await loadingTask.destroy();
  }
}

/**
 * Estrazione locale del testo di un allegato PDF (FASE 10, docs/FASE-10-LETTURA-ALLEGATI.md,
 * livello 2). Rileva prima se i byte sono davvero un PDF (magic number `%PDF-`): se non lo
 * sono — caso delle fixture mock/seed, che dichiarano `mimeType: application/pdf` ma scrivono
 * già testo semplice come contenuto — tratta i byte come testo già pronto, esattamente il
 * comportamento preesistente (nessuna modalità speciale legata a `EMAIL_PROVIDER=mock`).
 */
export async function extractPdfText(content: Buffer, sizeBytes: number): Promise<PdfTextExtractionResult> {
  if (!isRealPdf(content)) {
    const text = content.toString("utf-8");
    return {
      needsVisionFallback: false,
      outcome: { status: "SUCCEEDED", method: "LOCAL_TEXT", pages: [{ page: 1, text }], pageCount: 1, extractionCostUsd: null },
    };
  }

  if (sizeBytes > env.ATTACHMENT_EXTRACTION_MAX_SIZE_BYTES) {
    return {
      needsVisionFallback: false,
      outcome: { status: "FAILED", reason: `Allegato oltre il limite di dimensione (${env.ATTACHMENT_EXTRACTION_MAX_SIZE_BYTES} byte).` },
    };
  }

  try {
    const { pages, totalPageCount, partial } = await withTimeout(extractRealPdfPages(content), env.ATTACHMENT_EXTRACTION_TIMEOUT_MS);
    const totalChars = pages.reduce((sum, p) => sum + p.text.length, 0);
    const density = pages.length > 0 ? totalChars / pages.length : 0;
    const needsVisionFallback = density < env.ATTACHMENT_TEXT_DENSITY_MIN_CHARS_PER_PAGE;

    return {
      needsVisionFallback,
      outcome: {
        status: "SUCCEEDED",
        method: "LOCAL_TEXT",
        pages,
        pageCount: totalPageCount,
        extractionCostUsd: null,
        ...(partial
          ? { partialNote: `Estrazione parziale: superato il limite di ${env.ATTACHMENT_EXTRACTION_MAX_PAGES} pagine, elaborate solo le prime ${pages.length} di ${totalPageCount}.` }
          : {}),
      },
    };
  } catch (error) {
    const isTimeout = error instanceof Error && error.message === "timeout";
    return {
      needsVisionFallback: !isTimeout,
      outcome: {
        status: "FAILED",
        reason: isTimeout ? "Timeout durante l'estrazione del PDF." : "PDF corrotto o illeggibile con l'estrazione locale.",
      },
    };
  }
}
