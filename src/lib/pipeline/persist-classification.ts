import type { Prisma } from "@/generated/prisma/client";
import type { CasePriority, CaseStatus } from "@/generated/prisma/enums";
import type { ProcessMessageResult } from "./types";
import { generateCaseReference } from "./generate-case-reference";
import { writeAuditLog } from "./audit";

const NON_REGRESSABLE_STATUSES: CaseStatus[] = ["IN_PROGRESS", "ASSIGNED", "WAITING_CUSTOMER", "WAITING_INTERNAL", "COMPLETED", "ARCHIVED"];

export interface PersistClassificationResult {
  caseId: string;
  isNewCase: boolean;
}

/**
 * Crea/aggiorna la pratica e collega il messaggio (SPEC.md §6, §7). Il motore di regole può
 * solo escalare priority/status/needsHumanReview: una pratica già IN_PROGRESS/ASSIGNED/ecc. non
 * regredisce mai a NEW, solo eventualmente a NEEDS_REVIEW se una regola lo richiede.
 */
export async function persistClassification(
  tx: Prisma.TransactionClient,
  providerName: string,
  result: ProcessMessageResult,
): Promise<PersistClassificationResult> {
  const { input, classification, classificationCategory, match, ruleOutcome, now } = result;

  let caseId: string;
  let isNewCase: boolean;

  if (match.caseId) {
    caseId = match.caseId;
    isNewCase = false;
    const existing = await tx.case.findUniqueOrThrow({ where: { id: caseId } });

    const finalPriority: CasePriority = ruleOutcome?.priority ?? existing.priority;
    const finalNeedsHumanReview = existing.needsHumanReview || (ruleOutcome?.needsHumanReview ?? false);
    const finalStatus: CaseStatus = ruleOutcome
      ? ruleOutcome.needsHumanReview
        ? "NEEDS_REVIEW"
        : NON_REGRESSABLE_STATUSES.includes(existing.status)
          ? existing.status
          : ruleOutcome.status
      : existing.status;

    await tx.case.update({
      where: { id: caseId },
      data: {
        status: finalStatus,
        priority: finalPriority,
        needsHumanReview: finalNeedsHumanReview,
        confidence: classification.data.confidence,
        secondaryCategories: [...new Set([...existing.secondaryCategories, ...classification.data.secondary_categories])],
      },
    });
  } else {
    isNewCase = true;
    const reference = await generateCaseReference(tx, now);
    const created = await tx.case.create({
      data: {
        reference,
        title: classification.data.short_title,
        category: classificationCategory,
        secondaryCategories: classification.data.secondary_categories,
        status: ruleOutcome?.status ?? (classification.data.needs_human_review ? "NEEDS_REVIEW" : "NEW"),
        priority: ruleOutcome?.priority ?? classification.data.priority,
        summary: classification.data.summary,
        department: classification.data.responsible_department,
        isPec: input.isPec,
        needsHumanReview: ruleOutcome?.needsHumanReview ?? classification.data.needs_human_review,
        confidence: classification.data.confidence,
      },
    });
    caseId = created.id;
  }

  await tx.emailMessage.update({
    where: { id: input.emailMessageId },
    data: {
      caseId,
      securityFlags: classification.data.security_flags.length > 0 ? classification.data.security_flags : undefined,
    },
  });

  await tx.classificationRun.create({
    data: {
      emailMessageId: input.emailMessageId,
      caseId,
      llmProvider: providerName,
      model: classification.model,
      status: "SUCCEEDED",
      resultJson: classification.data,
      inputTokens: classification.usage.inputTokens,
      outputTokens: classification.usage.outputTokens,
      costUsd: classification.usage.costUsd,
      startedAt: now,
      finishedAt: now,
    },
  });

  await writeAuditLog(tx, {
    action: isNewCase ? "CASE_CREATED" : "CASE_LINKED",
    entityType: "Case",
    entityId: caseId,
    caseId,
    metadata: { emailMessageId: input.emailMessageId, matchLevel: match.level, matchConfidence: match.confidence },
  });

  if (classification.data.security_flags.length > 0) {
    await writeAuditLog(tx, {
      action: "SECURITY_FLAG_DETECTED",
      entityType: "EmailMessage",
      entityId: input.emailMessageId,
      caseId,
      metadata: { securityFlags: classification.data.security_flags },
    });
  }

  if (match.possibleDuplicateOf) {
    await tx.caseRelation.create({
      data: {
        caseId,
        relatedCaseId: match.possibleDuplicateOf.caseId,
        kind: "DUPLICATE_CANDIDATE",
        status: "PENDING",
        confidence: match.possibleDuplicateOf.confidence,
        matchLevel: match.possibleDuplicateOf.level,
        reason: `Possibile corrispondenza a livello "${match.possibleDuplicateOf.level}" con confidenza ${match.possibleDuplicateOf.confidence.toFixed(2)}`,
      },
    });
    await writeAuditLog(tx, {
      action: "POSSIBLE_DUPLICATE_FLAGGED",
      entityType: "Case",
      entityId: caseId,
      caseId,
      metadata: {
        relatedCaseId: match.possibleDuplicateOf.caseId,
        level: match.possibleDuplicateOf.level,
        confidence: match.possibleDuplicateOf.confidence,
      },
    });
  }

  return { caseId, isNewCase };
}
