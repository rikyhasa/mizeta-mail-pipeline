import { prisma } from "../src/lib/db/prisma";
import { getCachedLLMProvider } from "../src/lib/adapters/llm/llm-provider-factory";
import { getRuleSettings } from "../src/lib/rules/settings-repository";
import { applyRules } from "../src/lib/rules/engine";
import { isExtractableCategory } from "../src/lib/adapters/llm/schemas/extraction-index";
import {
  detectAmountMismatch,
  deduceDeadlines,
  loadCaseMessages,
  readFieldValue,
} from "../src/lib/pipeline/process-incoming-message";
import { persistExtraction } from "../src/lib/pipeline/persist-extraction";
import { persistActions } from "../src/lib/pipeline/persist-actions";
import { createDraftForCase } from "../src/lib/pipeline/create-draft-for-case";
import type { LLMProvider } from "../src/lib/adapters/llm/types";
import type { RuleBaseline, RuleContext, RuleSettingsData } from "../src/lib/rules/types";
import type { ExtractionOutcome } from "../src/lib/pipeline/types";

/** Coppia fattura duplicata già usata da tests/integration/seed-integrity.test.ts (EML-009/EML-010). */
const KNOWN_DUPLICATE_PAIR = { firstCaseKey: "case-009", duplicateCaseKey: "case-010" };

async function seedKnownDuplicateRelation(caseMap: Map<string, string>): Promise<void> {
  const firstCaseId = caseMap.get(KNOWN_DUPLICATE_PAIR.firstCaseKey);
  const duplicateCaseId = caseMap.get(KNOWN_DUPLICATE_PAIR.duplicateCaseKey);
  if (!firstCaseId || !duplicateCaseId) return;

  await prisma.caseRelation.upsert({
    where: { caseId_relatedCaseId_kind: { caseId: duplicateCaseId, relatedCaseId: firstCaseId, kind: "DUPLICATE_CANDIDATE" } },
    update: {},
    create: {
      caseId: duplicateCaseId,
      relatedCaseId: firstCaseId,
      kind: "DUPLICATE_CANDIDATE",
      status: "PENDING",
      confidence: 0.9,
      matchLevel: "invoice_number",
      reason: "Stesso numero fattura di una pratica già esistente: possibile fattura duplicata.",
    },
  });
}

async function enrichCase(caseId: string, llmProvider: LLMProvider, settings: RuleSettingsData): Promise<void> {
  const caseRecord = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
  const messages = await loadCaseMessages(caseId);
  if (messages.length === 0) return;

  let firstClassification: Awaited<ReturnType<LLMProvider["classify"]>> | null = null;
  let lastClassification: Awaited<ReturnType<LLMProvider["classify"]>> | null = null;

  for (const message of messages) {
    const result = await llmProvider.classify({
      emailMessageId: message.emailMessageId,
      emailSubject: message.subject,
      emailBody: message.bodyText,
      attachments: message.attachments,
    });

    await prisma.$transaction(async (tx) => {
      await tx.classificationRun.create({
        data: {
          emailMessageId: message.emailMessageId,
          caseId,
          llmProvider: llmProvider.providerName,
          model: result.model,
          status: "SUCCEEDED",
          resultJson: result.data,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          costUsd: result.usage.costUsd,
          startedAt: new Date(),
          finishedAt: new Date(),
        },
      });
      if (result.data.security_flags.length > 0) {
        await tx.emailMessage.update({ where: { id: message.emailMessageId }, data: { securityFlags: result.data.security_flags } });
      }
    });

    if (!firstClassification) firstClassification = result;
    lastClassification = result;
  }
  if (!firstClassification || !lastClassification) return;

  // Additivo: mai sovrascrivere category/priority/status/needsHumanReview già fissati dal
  // fixture — solo i campi oggi sempre null nel seed "ingenuo" (summary/department/confidence).
  await prisma.case.update({
    where: { id: caseId },
    data: {
      summary: caseRecord.summary ?? firstClassification.data.summary,
      department: caseRecord.department ?? firstClassification.data.responsible_department,
      confidence: lastClassification.data.confidence,
    },
  });

  const category = caseRecord.category;
  let extraction: ExtractionOutcome | null = null;
  if (isExtractableCategory(category)) {
    const extractionResult = await llmProvider.extractFields({ caseId, category, messages });
    extraction = { category, result: extractionResult };
  }

  const now = new Date();
  const messagesById = new Map(messages.map((m) => [m.emailMessageId, { receivedAt: m.receivedAt }]));
  const deadlines = deduceDeadlines(category, extraction, firstClassification.data.deadline, now, settings, messagesById);

  await prisma.$transaction(async (tx) => {
    await persistExtraction(tx, llmProvider.providerName, caseId, { extraction, deadlines, now });
  });

  const hasUnreadableAttachment = messages.some((m) => m.attachments.some((a) => !a.isReadable));
  const pendingDuplicate = await prisma.caseRelation.findFirst({ where: { caseId, kind: "DUPLICATE_CANDIDATE", status: "PENDING" } });
  const amountMismatchDetected = category === "SUPPLIER_INVOICE" ? detectAmountMismatch(messages, settings.amountMismatchTolerancePercent) : false;

  let claimRequestedAmount: number | null = null;
  if (category === "CLAIM_OR_DAMAGE" && extraction) {
    const value = readFieldValue(extraction.result.data as Record<string, unknown>, "requested_amount");
    claimRequestedAmount = typeof value === "number" ? value : null;
  }

  let quoteResponseDueAt: Date | null = null;
  if (category === "QUOTE_REQUEST") {
    const value = extraction ? readFieldValue(extraction.result.data as Record<string, unknown>, "response_due_at") : null;
    if (typeof value === "string") quoteResponseDueAt = new Date(value);
    else if (firstClassification.data.deadline) quoteResponseDueAt = new Date(firstClassification.data.deadline);
  }

  const ruleContext: RuleContext = {
    category,
    deadlines: deadlines.map((d) => ({ kind: d.kind, dueAt: d.dueAt })),
    hasUnreadableAttachment,
    possibleDuplicate: Boolean(pendingDuplicate),
    amountMismatchDetected,
    ibanMismatch: false,
    claimRequestedAmount,
    quoteResponseDueAt,
    classificationConfidence: lastClassification.data.confidence,
    now,
  };

  const baseline: RuleBaseline = {
    priority: caseRecord.priority,
    status: caseRecord.status,
    needsHumanReview: caseRecord.needsHumanReview,
    reasons: [],
  };

  // Solo-escalation (src/lib/rules/engine.ts): non può mai declassare i valori già fissati dal
  // fixture — sicuro per le asserzioni di tests/integration/seed-integrity.test.ts.
  const ruleOutcome = applyRules(baseline, ruleContext, settings);
  await prisma.case.update({
    where: { id: caseId },
    data: { priority: ruleOutcome.priority, status: ruleOutcome.status, needsHumanReview: ruleOutcome.needsHumanReview },
  });

  const extractedFieldValues: Record<string, string | number | boolean | null> = {};
  if (extraction) {
    for (const [key, raw] of Object.entries(extraction.result.data as Record<string, unknown>)) {
      if (raw && typeof raw === "object" && "value" in raw) {
        const value = (raw as { value: unknown }).value;
        if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          extractedFieldValues[key] = value;
        }
      }
    }
  }

  const actionProposal = await llmProvider.proposeActions({
    caseId,
    category,
    classification: lastClassification.data,
    extractedFieldValues,
  });

  await prisma.$transaction(async (tx) => {
    await persistActions(tx, llmProvider.providerName, caseId, { actionProposal, now });
  });

  if (actionProposal.data.draft_reply_recommended) {
    await prisma.$transaction(async (tx) => {
      await createDraftForCase(tx, { caseId, llmProvider, actorId: null });
    });
  }
}

/**
 * Passaggio additivo eseguito dopo il seed "ingenuo" (SPEC.md §21 Fase 3): usa la pipeline
 * reale (provider da `env.LLM_PROVIDER`, mock in modalità demo) per popolare CaseField,
 * CaseDeadline, i vari *Run e le bozze — SENZA mai ridecidere categoria o matching, che
 * restano quelli già fissati dai fixture in prisma/seed-data/emails.ts.
 */
export async function enrichCasesWithPipelineArtifacts(caseMap: Map<string, string>): Promise<void> {
  const llmProvider = getCachedLLMProvider();
  const settings = await getRuleSettings();

  await seedKnownDuplicateRelation(caseMap);

  let done = 0;
  for (const caseId of caseMap.values()) {
    await enrichCase(caseId, llmProvider, settings);
    done += 1;
  }
  console.log(`Arricchimento pipeline completato per ${done} pratiche (campi, scadenze, regole, bozze).`);
}
