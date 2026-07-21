import { prisma } from "@/lib/db/prisma";
import { PENDING_VISION_STATUSES } from "@/lib/attachments/extract-message-attachments";

export interface JobStatusCounts {
  PENDING: number;
  RUNNING: number;
  SUCCEEDED: number;
  FAILED: number;
  DEAD_LETTER: number;
}

export interface AiRunWindowSummary {
  succeeded: number;
  failed: number;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
}

export interface MailboxObservabilityRow {
  id: string;
  displayName: string;
  provider: string;
  status: string;
  lastSyncAt: Date | null;
  lastHealthStatus: string | null;
  subscriptionExpiresAt: Date | null;
}

export interface ManualCorrectionWindowSummary {
  fieldsUpdated: number;
  fieldsConfirmed: number;
}

/** FASE 10, docs/FASE-10-LETTURA-ALLEGATI.md §"Metriche in osservabilità": allegati processati
 * per metodo, fallimenti, costo visione cumulato, pagine per documento. */
export interface AttachmentExtractionWindowSummary {
  structured: number;
  localText: number;
  vision: number;
  failed: number;
  totalPages: number;
  visionCostUsd: number;
}

export interface ObservabilitySnapshot {
  jobs: JobStatusCounts;
  mailboxes: MailboxObservabilityRow[];
  aiRuns: { last24h: AiRunWindowSummary; last7d: AiRunWindowSummary };
  manualCorrections: { last24h: ManualCorrectionWindowSummary; last7d: ManualCorrectionWindowSummary };
  attachmentExtraction: { last24h: AttachmentExtractionWindowSummary; last7d: AttachmentExtractionWindowSummary; deferredBudgetPending: number };
}

async function getJobStatusCounts(): Promise<JobStatusCounts> {
  const grouped = await prisma.job.groupBy({ by: ["status"], _count: { _all: true } });
  const counts: JobStatusCounts = { PENDING: 0, RUNNING: 0, SUCCEEDED: 0, FAILED: 0, DEAD_LETTER: 0 };
  for (const row of grouped) counts[row.status] = row._count._all;
  return counts;
}

function addGroup(
  summary: AiRunWindowSummary,
  rows: { status: string; _count: { _all: number }; _sum: { costUsd: unknown; inputTokens: number | null; outputTokens: number | null } }[],
): void {
  for (const row of rows) {
    if (row.status === "SUCCEEDED") summary.succeeded += row._count._all;
    if (row.status === "FAILED") summary.failed += row._count._all;
    summary.costUsd += row._sum.costUsd ? Number(row._sum.costUsd) : 0;
    summary.inputTokens += row._sum.inputTokens ?? 0;
    summary.outputTokens += row._sum.outputTokens ?? 0;
  }
}

/**
 * Aggrega costo/token/stato delle tre tabelle `*Run` già popolate dalla Fase 2 (SPEC.md §17:
 * "costo e token delle chiamate AI"). Nessuna nuova tabella di metriche: i dati esistono già,
 * qui vengono solo sommati per finestra temporale.
 */
async function getAiRunWindowSummary(since: Date): Promise<AiRunWindowSummary> {
  const summary: AiRunWindowSummary = { succeeded: 0, failed: 0, costUsd: 0, inputTokens: 0, outputTokens: 0 };

  const [classificationRuns, extractionRuns, actionProposalRuns] = await Promise.all([
    prisma.classificationRun.groupBy({
      by: ["status"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
    }),
    prisma.extractionRun.groupBy({
      by: ["status"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
    }),
    prisma.actionProposalRun.groupBy({
      by: ["status"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
    }),
  ]);

  addGroup(summary, classificationRuns);
  addGroup(summary, extractionRuns);
  addGroup(summary, actionProposalRuns);
  return summary;
}

/**
 * Tasso di correzione manuale (SPEC.md §17: "classificazioni corrette manualmente"): conta gli
 * `AuditLog` `FIELD_UPDATED` (l'utente ha cambiato un valore proposto dall'AI) e `FIELD_CONFIRMED`
 * (l'utente ha convalidato il valore così com'è) nella finestra. Nessuna nuova tabella: l'audit
 * log è già la fonte di verità immutabile per queste azioni (SPEC.md §15).
 */
async function getManualCorrectionWindowSummary(since: Date): Promise<ManualCorrectionWindowSummary> {
  const grouped = await prisma.auditLog.groupBy({
    by: ["action"],
    where: { action: { in: ["FIELD_UPDATED", "FIELD_CONFIRMED"] }, createdAt: { gte: since } },
    _count: { _all: true },
  });
  const summary: ManualCorrectionWindowSummary = { fieldsUpdated: 0, fieldsConfirmed: 0 };
  for (const row of grouped) {
    if (row.action === "FIELD_UPDATED") summary.fieldsUpdated = row._count._all;
    if (row.action === "FIELD_CONFIRMED") summary.fieldsConfirmed = row._count._all;
  }
  return summary;
}

/**
 * Estrazione allegati per metodo/esito nella finestra (FASE 10): stesso pattern di aggregazione
 * di `getAiRunWindowSummary`, sulla tabella `Attachment` già popolata dal job
 * `EXTRACT_ATTACHMENTS`. `visionCostUsd` conta solo le estrazioni riuscite (una rinviata per
 * budget non ha generato alcuna spesa).
 */
async function getAttachmentExtractionWindowSummary(since: Date): Promise<AttachmentExtractionWindowSummary> {
  const [byMethod, failed] = await Promise.all([
    prisma.attachment.groupBy({
      by: ["extractionMethod"],
      where: { extractionStatus: "SUCCEEDED", extractedAt: { gte: since } },
      _count: { _all: true },
      _sum: { pageCount: true, extractionCostUsd: true },
    }),
    prisma.attachment.count({ where: { extractionStatus: "FAILED", extractedAt: { gte: since } } }),
  ]);

  const summary: AttachmentExtractionWindowSummary = { structured: 0, localText: 0, vision: 0, failed, totalPages: 0, visionCostUsd: 0 };
  for (const row of byMethod) {
    const count = row._count._all;
    if (row.extractionMethod === "STRUCTURED") summary.structured += count;
    if (row.extractionMethod === "LOCAL_TEXT") summary.localText += count;
    if (row.extractionMethod === "VISION") {
      summary.vision += count;
      summary.visionCostUsd += row._sum.extractionCostUsd ? Number(row._sum.extractionCostUsd) : 0;
    }
    summary.totalPages += row._sum.pageCount ?? 0;
  }
  return summary;
}

/** Snapshot di osservabilità (SPEC.md §17): stato coda job, stato/scadenza subscription per
 * mailbox, costo/errori AI e correzioni manuali nelle ultime 24h/7g. Esposto solo da
 * `/api/observability` (`settings:manage`): contiene dettaglio costi/errori, non è liveness
 * pubblica. */
export async function getObservabilitySnapshot(): Promise<ObservabilitySnapshot> {
  const now = Date.now();
  const since24h = new Date(now - 24 * 60 * 60 * 1000);
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const [
    jobs,
    mailboxes,
    aiRunsLast24h,
    aiRunsLast7d,
    correctionsLast24h,
    correctionsLast7d,
    attachmentExtractionLast24h,
    attachmentExtractionLast7d,
    deferredBudgetPending,
  ] = await Promise.all([
    getJobStatusCounts(),
    prisma.mailboxConnection.findMany({
      select: {
        id: true,
        displayName: true,
        provider: true,
        status: true,
        lastSyncAt: true,
        lastHealthStatus: true,
        subscriptionExpiresAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    getAiRunWindowSummary(since24h),
    getAiRunWindowSummary(since7d),
    getManualCorrectionWindowSummary(since24h),
    getManualCorrectionWindowSummary(since7d),
    getAttachmentExtractionWindowSummary(since24h),
    getAttachmentExtractionWindowSummary(since7d),
    prisma.attachment.count({ where: { extractionStatus: { in: [...PENDING_VISION_STATUSES] } } }),
  ]);

  return {
    jobs,
    mailboxes,
    aiRuns: { last24h: aiRunsLast24h, last7d: aiRunsLast7d },
    manualCorrections: { last24h: correctionsLast24h, last7d: correctionsLast7d },
    attachmentExtraction: { last24h: attachmentExtractionLast24h, last7d: attachmentExtractionLast7d, deferredBudgetPending },
  };
}
