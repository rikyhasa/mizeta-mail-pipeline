import puppeteer, { type Browser } from "puppeteer";
import { prisma } from "@/lib/db/prisma";
import { attachmentStorage } from "@/lib/storage/local-storage";
import type { GeneratedDocumentFormat, GeneratedDocumentType } from "@/generated/prisma/enums";
import type { GeneratedDocumentService } from "@/lib/adapters/documents/types";
import { renderQuoteSheetHtml } from "@/lib/adapters/documents/templates/quote-sheet";
import { renderClaimDossierHtml } from "@/lib/adapters/documents/templates/claim-dossier";
import { renderFineSheetHtml } from "@/lib/adapters/documents/templates/fine-sheet";
import type { DocumentCaseField, DocumentCaseInfo } from "@/lib/adapters/documents/templates/shared";

type TemplateRenderer = (caseInfo: DocumentCaseInfo, fields: DocumentCaseField[]) => string;

/** Solo i 3 tipi richiesti dalla SPEC.md §12 per questa fase sono implementati; gli altri 5
 * (report/briefing, post-MVP per la generazione PowerPoint) restano un 501 nella route. */
const TEMPLATE_BY_TYPE: Partial<Record<GeneratedDocumentType, TemplateRenderer>> = {
  QUOTE_SHEET: renderQuoteSheetHtml,
  CLAIM_DOSSIER: renderClaimDossierHtml,
  FINE_SHEET: renderFineSheetHtml,
};

let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (!browserPromise) browserPromise = puppeteer.launch({ headless: true });
  return browserPromise;
}

/** Usata dai test per chiudere il browser headless dopo la suite, evitando processi Chromium
 * orfani. Mai chiamata dal codice applicativo: l'istanza è un singleton di modulo, riusata tra
 * generazioni successive. */
export async function closeSharedBrowser(): Promise<void> {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
    browserPromise = null;
  }
}

/**
 * Implementazione `GeneratedDocumentService` (SPEC.md §12) via Chromium headless: template
 * HTML puri (funzioni stringa, non `react-dom/server` — sono documenti di stampa, non UI
 * interattiva) renderizzati con `page.setContent` + `page.pdf()`, salvati tramite
 * `AttachmentStorage` (stessa interfaccia usata per gli allegati email).
 */
export class PuppeteerDocumentService implements GeneratedDocumentService {
  async generate(input: {
    caseId: string;
    type: GeneratedDocumentType;
    format: GeneratedDocumentFormat;
  }): Promise<{ storageKey: string }> {
    const renderTemplate = TEMPLATE_BY_TYPE[input.type];
    if (!renderTemplate) {
      throw new Error(`Tipo documento non ancora implementato in questa fase: ${input.type}.`);
    }

    const caseRecord = await prisma.case.findUniqueOrThrow({
      where: { id: input.caseId },
      include: { customer: true, supplier: true, fields: true },
    });

    const caseInfo: DocumentCaseInfo = {
      reference: caseRecord.reference,
      title: caseRecord.title,
      customerName: caseRecord.customer?.name,
      supplierName: caseRecord.supplier?.name,
      createdAt: caseRecord.createdAt,
    };
    const fields: DocumentCaseField[] = caseRecord.fields.map((f) => ({
      fieldKey: f.fieldKey,
      value: f.value,
      needsHumanReview: f.needsHumanReview,
    }));

    const html = renderTemplate(caseInfo, fields);

    if (input.format === "HTML") {
      const storageKey = `documents/${input.caseId}/${input.type}-${Date.now()}.html`;
      await attachmentStorage.put(storageKey, html);
      return { storageKey };
    }

    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: "load" });
      const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
      const storageKey = `documents/${input.caseId}/${input.type}-${Date.now()}.pdf`;
      await attachmentStorage.put(storageKey, Buffer.from(pdfBuffer));
      return { storageKey };
    } finally {
      await page.close();
    }
  }
}

export const puppeteerDocumentService = new PuppeteerDocumentService();
