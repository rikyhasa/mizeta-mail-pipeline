import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/config/env";
import { romeMidnightToUtcDate } from "@/lib/text/date-normalizer";
import type { AttachmentExtractionOutcome } from "@/lib/attachments/types";
import type { AttachmentVisionExtractionInput, LLMProvider } from "@/lib/adapters/llm/types";

/** jpeg/png/gif/webp per le immagini, PDF nativo per i documenti (nessun HEIC: non supportato
 * dall'input multimodale del provider — limitazione nota, da documentare, mai finta di
 * funzionare). */
const SUPPORTED_VISION_MIME_TYPES = new Set<AttachmentVisionExtractionInput["mimeType"]>([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

function isSupportedVisionMimeType(mimeType: string): mimeType is AttachmentVisionExtractionInput["mimeType"] {
  return (SUPPORTED_VISION_MIME_TYPES as Set<string>).has(mimeType);
}

function todayRomeBounds(now: Date): { start: Date; end: Date } {
  const isoDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(now);
  const start = romeMidnightToUtcDate(isoDate);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/** Spesa cumulata di oggi (fuso Europe/Rome, CLAUDE.md) per l'estrazione visione — confrontata
 * col budget giornaliero configurabile in Impostazioni prima di ogni nuova chiamata. */
export async function getVisionSpendToday(now: Date = new Date()): Promise<number> {
  const { start, end } = todayRomeBounds(now);
  const result = await prisma.attachment.aggregate({
    where: { extractionMethod: "VISION", extractedAt: { gte: start, lt: end } },
    _sum: { extractionCostUsd: true },
  });
  const sum = result._sum.extractionCostUsd;
  return sum === null ? 0 : Number(sum);
}

/**
 * Livello 3 di estrazione allegati (FASE 10, docs/FASE-10-LETTURA-ALLEGATI.md): usato solo
 * quando il livello 2 (testo locale) produce testo assente/scarso, o per immagini dirette.
 * Gated dal budget giornaliero (RuleSettings.visionExtractionDailyBudgetUsd, Impostazioni):
 * budget esaurito → DEFERRED_BUDGET, mai un tentativo silenzioso di procedere comunque né una
 * spesa mai limitata (SPEC.md §16).
 */
export async function extractAttachmentVision(
  llmProvider: LLMProvider,
  attachment: { attachmentId: string; fileName: string; mimeType: string; sizeBytes: number; content: Buffer },
  dailyBudgetUsd: number,
  now: Date = new Date(),
): Promise<AttachmentExtractionOutcome> {
  if (!isSupportedVisionMimeType(attachment.mimeType)) {
    return {
      status: "FAILED",
      reason: `Formato "${attachment.mimeType}" non supportato dall'estrazione visione (es. HEIC): richiede conversione manuale, non gestita in questa fase.`,
    };
  }

  if (attachment.sizeBytes > env.ATTACHMENT_EXTRACTION_MAX_SIZE_BYTES) {
    return { status: "FAILED", reason: `Allegato oltre il limite di dimensione (${env.ATTACHMENT_EXTRACTION_MAX_SIZE_BYTES} byte).` };
  }

  const spentToday = await getVisionSpendToday(now);
  if (spentToday >= dailyBudgetUsd) {
    return {
      status: "DEFERRED_BUDGET",
      reason: `Budget giornaliero di estrazione visione esaurito (${spentToday.toFixed(2)}/${dailyBudgetUsd.toFixed(2)} USD).`,
    };
  }

  try {
    const result = await llmProvider.extractAttachmentVisionText({
      attachmentId: attachment.attachmentId,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      contentBase64: attachment.content.toString("base64"),
    });
    // `result.data.security_flags` è un segnale aggiuntivo del solo passaggio visione: il
    // testo trascritto rientra comunque nella pipeline come qualunque altro ATTACHMENT_CONTENT
    // e viene ri-scansionato dal passaggio di classificazione — non serve propagarlo qui.
    return {
      status: "SUCCEEDED",
      method: "VISION",
      pages: result.data.pages.map((p) => ({ page: p.page_number, text: p.text })),
      pageCount: result.data.pages.length,
      extractionCostUsd: result.usage.costUsd,
    };
  } catch (error) {
    return { status: "FAILED", reason: error instanceof Error ? error.message : "Errore durante l'estrazione visione." };
  }
}
