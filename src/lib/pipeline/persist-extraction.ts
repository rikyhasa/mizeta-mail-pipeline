import type { Prisma } from "@/generated/prisma/client";
import type { FieldSourceType } from "@/generated/prisma/enums";
import type { ProcessMessageResult } from "./types";

interface ExtractedFieldShape {
  value: unknown;
  normalized_value: string | null;
  confidence: number | null;
  source_type: string | null;
  source_message_id: string | null;
  source_attachment_id: string | null;
  source_page: number | null;
  source_excerpt: string | null;
  needs_human_review: boolean;
}

function isExtractedField(raw: unknown): raw is ExtractedFieldShape {
  return Boolean(raw) && typeof raw === "object" && "value" in (raw as object) && "needs_human_review" in (raw as object);
}

/**
 * Persiste CaseField (un campo estratto per fieldKey, upsert idempotente grazie a
 * @@unique([caseId, fieldKey])) e CaseDeadline. Sintetizza `erp_verified_status` per
 * CUSTOMER_RECEIVABLE server-side (mai chiesto al modello, SPEC.md §6, CLAUDE.md invariante 4).
 */
export async function persistExtraction(
  tx: Prisma.TransactionClient,
  providerName: string,
  caseId: string,
  result: Pick<ProcessMessageResult, "extraction" | "deadlines" | "now">,
): Promise<void> {
  const { extraction, deadlines, now } = result;
  if (!extraction) return;

  await tx.extractionRun.create({
    data: {
      caseId,
      llmProvider: providerName,
      model: extraction.result.model,
      status: "SUCCEEDED",
      resultJson: extraction.result.data as Prisma.InputJsonValue,
      inputTokens: extraction.result.usage.inputTokens,
      outputTokens: extraction.result.usage.outputTokens,
      costUsd: extraction.result.usage.costUsd,
      startedAt: now,
      finishedAt: now,
    },
  });

  const fields = extraction.result.data as Record<string, unknown>;
  for (const [fieldKey, raw] of Object.entries(fields)) {
    if (!isExtractedField(raw)) continue; // salta array semplici (missing_data, missing_documents)

    const value = raw.value === null || raw.value === undefined ? null : String(raw.value);
    await tx.caseField.upsert({
      where: { caseId_fieldKey: { caseId, fieldKey } },
      create: {
        caseId,
        fieldKey,
        value,
        normalizedValue: raw.normalized_value,
        confidence: raw.confidence,
        sourceType: raw.source_type as FieldSourceType | null,
        sourceMessageId: raw.source_message_id,
        sourceAttachmentId: raw.source_attachment_id,
        sourcePage: raw.source_page,
        sourceExcerpt: raw.source_excerpt,
        needsHumanReview: raw.needs_human_review,
      },
      update: {
        value,
        normalizedValue: raw.normalized_value,
        confidence: raw.confidence,
        sourceType: raw.source_type as FieldSourceType | null,
        sourceMessageId: raw.source_message_id,
        sourceAttachmentId: raw.source_attachment_id,
        sourcePage: raw.source_page,
        sourceExcerpt: raw.source_excerpt,
        needsHumanReview: raw.needs_human_review,
      },
    });
  }

  if (extraction.category === "CUSTOMER_RECEIVABLE") {
    await tx.caseField.upsert({
      where: { caseId_fieldKey: { caseId, fieldKey: "erp_verified_status" } },
      create: {
        caseId,
        fieldKey: "erp_verified_status",
        value: null,
        sourceType: "SYSTEM",
        sourceExcerpt: "ERPAdapter non implementato in questa fase.",
        needsHumanReview: false,
      },
      update: {},
    });
  }

  for (const deadline of deadlines) {
    await tx.caseDeadline.create({
      data: { caseId, kind: deadline.kind, label: deadline.label, dueAt: deadline.dueAt, isCritical: deadline.isCritical },
    });
  }
}
