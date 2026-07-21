import { Prisma } from "@/generated/prisma/client";
import type { Attachment } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { attachmentStorage } from "@/lib/storage/local-storage";
import { getCachedLLMProvider } from "@/lib/adapters/llm/llm-provider-factory";
import type { LLMProvider } from "@/lib/adapters/llm/types";
import { getRuleSettings } from "@/lib/rules/settings-repository";
import { logger } from "@/lib/observability/logger";
import { enqueueJob } from "@/lib/jobs/queue";
import { processIncomingMessageIdempotencyKey } from "@/lib/jobs/types";
import { computeContentHash } from "@/lib/attachments/content-hash";
import { extractStructuredFatturaPa } from "@/lib/attachments/extractors/structured-fattura-pa";
import { extractPdfText } from "@/lib/attachments/extractors/pdf-text";
import { extractAttachmentVision } from "@/lib/attachments/extractors/vision";
import type { AttachmentExtractionOutcome } from "@/lib/attachments/types";

function isStructuredCandidate(fileName: string): boolean {
  return /\.(xml|p7m)$/i.test(fileName);
}

/** Stati non definitivi in attesa del fallback visione, soggetti al retry ricorrente e sempre
 * di nuovo al budget giornaliero — mai un bypass (FASE 12, Bug 1: `PARTIAL_VISION_DEFERRED`
 * copre il caso in cui il locale aveva comunque prodotto testo). */
export const PENDING_VISION_STATUSES = ["DEFERRED_BUDGET", "PARTIAL_VISION_DEFERRED"] as const;

type AttachmentRow = Pick<Attachment, "id" | "fileName" | "mimeType" | "sizeBytes">;

// Nessun decoder aggiunto (limite noto, sempre dichiarato): rilevamento per MIME type e, in
// fallback, per estensione del nome file — un client email a volte invia HEIC con un MIME type
// generico (es. application/octet-stream), l'estensione resta il segnale più affidabile in quel
// caso, stesso principio di `isStructuredCandidate` sopra.
const HEIC_HEIF_MIME_TYPES = new Set(["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]);

export function isHeicOrHeifAttachment(attachment: Pick<AttachmentRow, "fileName" | "mimeType">): boolean {
  return HEIC_HEIF_MIME_TYPES.has(attachment.mimeType.toLowerCase()) || /\.(heic|heif)$/i.test(attachment.fileName);
}

/**
 * Strategia a tre livelli in ordine di costo (FASE 10, docs/FASE-10-LETTURA-ALLEGATI.md):
 * dati strutturati → testo PDF locale → visione, solo quando il livello 2 è insufficiente. Non
 * lancia mai eccezione: ogni esito è un `AttachmentExtractionOutcome` tipizzato, anche in caso
 * di errore imprevisto di un estrattore — un bug in un singolo allegato non deve mai bloccare
 * gli altri né l'intera email.
 */
async function extractOneAttachment(
  llmProvider: LLMProvider,
  attachment: AttachmentRow,
  content: Buffer,
  visionDailyBudgetUsd: number,
): Promise<AttachmentExtractionOutcome> {
  try {
    if (isStructuredCandidate(attachment.fileName)) {
      return extractStructuredFatturaPa(attachment.fileName, content);
    }

    // Rilevato esplicitamente prima del ramo image/* generico: nessun decoder HEIC/HEIF aggiunto
    // in questa fase (limite noto, mai finto di funzionare), ma un formato riconosciuto non deve
    // mai finire nel fallimento generico indistinguibile da un vero errore di parsing — stato
    // pulito dedicato, mai un crash del job (docs/FASE-10-LETTURA-ALLEGATI.md).
    if (isHeicOrHeifAttachment(attachment)) {
      return {
        status: "UNSUPPORTED_FORMAT",
        reason: `Formato immagine non supportato (${attachment.mimeType}) — converti manualmente in JPEG o PNG prima di allegarlo.`,
      };
    }

    if (attachment.mimeType === "application/pdf") {
      const { outcome, needsVisionFallback } = await extractPdfText(content, attachment.sizeBytes);
      if (!needsVisionFallback) return outcome;

      const visionOutcome = await extractAttachmentVision(
        llmProvider,
        { attachmentId: attachment.id, fileName: attachment.fileName, mimeType: attachment.mimeType, sizeBytes: attachment.sizeBytes, content },
        visionDailyBudgetUsd,
      );
      if (visionOutcome.status === "SUCCEEDED") return visionOutcome;
      if (visionOutcome.status === "DEFERRED_BUDGET" && outcome.status === "SUCCEEDED" && outcome.method === "LOCAL_TEXT") {
        // Il locale ha comunque prodotto testo (scarso ma non nullo): non va marcato SUCCEEDED,
        // altrimenti il job di retry non riproverà mai la visione (FASE 12, Bug 1).
        return { status: "PARTIAL_VISION_DEFERRED", method: "LOCAL_TEXT", pages: outcome.pages, pageCount: outcome.pageCount, reason: visionOutcome.reason };
      }
      // La visione è fallita (non per budget) o il livello locale non aveva prodotto nulla di
      // utilizzabile: se il livello locale aveva comunque un risultato, non buttarlo via — mai
      // perdere dati già estratti.
      return outcome.status === "SUCCEEDED" ? outcome : visionOutcome;
    }

    if (attachment.mimeType.startsWith("image/")) {
      return extractAttachmentVision(
        llmProvider,
        { attachmentId: attachment.id, fileName: attachment.fileName, mimeType: attachment.mimeType, sizeBytes: attachment.sizeBytes, content },
        visionDailyBudgetUsd,
      );
    }

    return { status: "FAILED", reason: `Formato allegato non gestito (${attachment.mimeType}).` };
  } catch (error) {
    logger.error("attachment.extraction.unexpected_error", {
      attachmentId: attachment.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return { status: "FAILED", reason: "Errore imprevisto durante l'estrazione." };
  }
}

function outcomeToUpdateData(outcome: AttachmentExtractionOutcome, extractedAt: Date | null): Prisma.AttachmentUpdateInput {
  if (outcome.status === "SUCCEEDED" && outcome.method === "STRUCTURED") {
    return {
      isReadable: true,
      extractionMethod: "STRUCTURED",
      extractionStatus: "SUCCEEDED",
      extractionError: null,
      pageCount: null,
      extractionCostUsd: null,
      extractedPages: Prisma.JsonNull,
      structuredFields: outcome.structuredFields as Prisma.InputJsonValue,
      extractedAt,
    };
  }
  if (outcome.status === "SUCCEEDED") {
    return {
      isReadable: true,
      extractionMethod: outcome.method,
      extractionStatus: "SUCCEEDED",
      extractionError: outcome.partialNote ?? null,
      pageCount: outcome.pageCount,
      extractionCostUsd: outcome.extractionCostUsd,
      extractedPages: outcome.pages as unknown as Prisma.InputJsonValue,
      structuredFields: Prisma.JsonNull,
      extractedAt,
    };
  }
  if (outcome.status === "DEFERRED_BUDGET") {
    return {
      isReadable: false,
      extractionMethod: null,
      extractionStatus: "DEFERRED_BUDGET",
      extractionError: outcome.reason,
      pageCount: null,
      extractionCostUsd: null,
      extractedPages: Prisma.JsonNull,
      structuredFields: Prisma.JsonNull,
      extractedAt: null,
    };
  }
  if (outcome.status === "PARTIAL_VISION_DEFERRED") {
    return {
      isReadable: true,
      extractionMethod: "LOCAL_TEXT",
      extractionStatus: "PARTIAL_VISION_DEFERRED",
      extractionError: outcome.reason,
      pageCount: outcome.pageCount,
      extractionCostUsd: null,
      extractedPages: outcome.pages as unknown as Prisma.InputJsonValue,
      structuredFields: Prisma.JsonNull,
      extractedAt: null,
    };
  }
  if (outcome.status === "UNSUPPORTED_FORMAT") {
    return {
      isReadable: false,
      extractionMethod: null,
      extractionStatus: "UNSUPPORTED_FORMAT",
      extractionError: outcome.reason,
      pageCount: null,
      extractionCostUsd: null,
      extractedPages: Prisma.JsonNull,
      structuredFields: Prisma.JsonNull,
      extractedAt,
    };
  }
  return {
    isReadable: false,
    extractionMethod: null,
    extractionStatus: "FAILED",
    extractionError: outcome.reason,
    pageCount: null,
    extractionCostUsd: null,
    extractedPages: Prisma.JsonNull,
    structuredFields: Prisma.JsonNull,
    extractedAt,
  };
}

/**
 * Job di ingestione: estrae il testo reale di ogni allegato di un messaggio PRIMA della
 * classificazione (FASE 10, docs/FASE-10-LETTURA-ALLEGATI.md), così `PROCESS_INCOMING_MESSAGE`
 * legge testo già pronto. Cache per `contentHash`: un allegato con lo stesso hash già estratto
 * con successo (anche su un altro messaggio — fattura duplicata) viene riusato senza rieseguire
 * alcun parser. Eccezioni propagate da qui sono solo errori infrastrutturali veri (storage
 * irraggiungibile): fanno fallire il job con retry/backoff esistenti (src/lib/jobs/worker.ts) —
 * mai un errore di parsing di un singolo allegato, sempre contenuto in un esito tipizzato.
 */
export async function extractMessageAttachments(emailMessageId: string): Promise<void> {
  const message = await prisma.emailMessage.findUniqueOrThrow({
    where: { id: emailMessageId },
    include: { attachments: true },
  });
  if (message.attachments.length === 0) return;

  const [settings, llmProvider] = [await getRuleSettings(), getCachedLLMProvider()];

  for (const attachment of message.attachments) {
    // Idempotenza: un allegato già estratto con successo non viene mai ri-elaborato (rilevante
    // per il job ricorrente di retry dei DEFERRED_BUDGET su un messaggio con più allegati).
    if (attachment.extractionStatus === "SUCCEEDED") continue;

    const content = await attachmentStorage.get(attachment.storageKey);
    const contentHash = attachment.contentHash ?? computeContentHash(content);

    const cached = await prisma.attachment.findFirst({
      where: { contentHash, extractionStatus: "SUCCEEDED", id: { not: attachment.id } },
      orderBy: { extractedAt: "desc" },
    });

    if (cached) {
      await prisma.attachment.update({
        where: { id: attachment.id },
        data: {
          contentHash,
          isReadable: cached.isReadable,
          extractionMethod: cached.extractionMethod,
          extractionStatus: "SUCCEEDED",
          extractionError: cached.extractionError,
          pageCount: cached.pageCount,
          // Il riuso da cache non genera una nuova spesa: nessuna chiamata visione è avvenuta.
          extractionCostUsd: null,
          extractedPages: cached.extractedPages === null ? Prisma.JsonNull : (cached.extractedPages as Prisma.InputJsonValue),
          structuredFields: cached.structuredFields === null ? Prisma.JsonNull : (cached.structuredFields as Prisma.InputJsonValue),
          extractedAt: new Date(),
        },
      });
      continue;
    }

    const outcome = await extractOneAttachment(llmProvider, attachment, content, settings.visionExtractionDailyBudgetUsd);
    // Gli stati pendenti (DEFERRED_BUDGET, PARTIAL_VISION_DEFERRED) restano senza data: esito
    // ancora non definitivo, riprovato dal job ricorrente. Tutti gli altri stati sono definitivi.
    const extractedAt = (PENDING_VISION_STATUSES as readonly string[]).includes(outcome.status) ? null : new Date();
    await prisma.attachment.update({
      where: { id: attachment.id },
      data: { contentHash, ...outcomeToUpdateData(outcome, extractedAt) },
    });
  }
}

/**
 * Job ricorrente: ritenta gli allegati rimasti in uno stato pendente di visione — `DEFERRED_BUDGET`
 * (budget esaurito, nessun testo locale) o `PARTIAL_VISION_DEFERRED` (testo locale scarso, visione
 * ancora da tentare) — di nuovo soggetti allo stesso budget giornaliero, mai un bypass. Per ogni
 * messaggio il cui numero di allegati ancora pendenti diminuisce (almeno uno è riuscito o
 * definitivamente fallito), riaccoda `PROCESS_INCOMING_MESSAGE`: solo così la pratica riflette
 * il nuovo dato, senza rielaborare inutilmente messaggi il cui esito non è cambiato.
 */
export async function retryDeferredAttachmentExtractions(): Promise<{ retriedMessageIds: string[]; resolvedMessageIds: string[] }> {
  const deferredAttachments = await prisma.attachment.findMany({
    where: { extractionStatus: { in: [...PENDING_VISION_STATUSES] } },
    select: { emailMessageId: true },
  });
  const messageIds = [...new Set(deferredAttachments.map((a) => a.emailMessageId))];

  const retriedMessageIds: string[] = [];
  const resolvedMessageIds: string[] = [];

  for (const emailMessageId of messageIds) {
    const before = await prisma.attachment.count({ where: { emailMessageId, extractionStatus: { in: [...PENDING_VISION_STATUSES] } } });
    await extractMessageAttachments(emailMessageId);
    const after = await prisma.attachment.count({ where: { emailMessageId, extractionStatus: { in: [...PENDING_VISION_STATUSES] } } });
    retriedMessageIds.push(emailMessageId);

    if (after < before) {
      resolvedMessageIds.push(emailMessageId);
      await enqueueJob({
        type: "PROCESS_INCOMING_MESSAGE",
        payload: { emailMessageId },
        idempotencyKey: processIncomingMessageIdempotencyKey(emailMessageId),
      });
    }
  }

  return { retriedMessageIds, resolvedMessageIds };
}
