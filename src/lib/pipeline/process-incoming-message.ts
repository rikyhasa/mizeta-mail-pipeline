import type { CaseCategory, DeadlineKind } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { attachmentStorage } from "@/lib/storage/local-storage";
import { isExtractableCategory } from "@/lib/adapters/llm/schemas/extraction-index";
import type { ClassificationResult } from "@/lib/adapters/llm/schemas";
import type { ExtractionMessageInput, LLMResult } from "@/lib/adapters/llm/types";
import { getCachedLLMProvider } from "@/lib/adapters/llm/llm-provider-factory";
import { matchEmailToCase } from "@/lib/matching/match-email-to-case";
import { PrismaCaseRepository } from "@/lib/matching/prisma-case-repository";
import { getRuleSettings } from "@/lib/rules/settings-repository";
import { applyRules } from "@/lib/rules/engine";
import type { RuleBaseline, RuleContext, RuleSettingsData } from "@/lib/rules/types";
import { findAmountNearAnchor } from "@/lib/text/patterns";
import { normalizeDateExpression, romeMidnightToUtcDate } from "@/lib/text/date-normalizer";
import { writeAuditLog } from "./audit";
import { persistClassification } from "./persist-classification";
import { persistExtraction } from "./persist-extraction";
import { persistActions } from "./persist-actions";
import { PipelineExtractionError } from "./types";
import type { DeducedDeadline, ExtractionOutcome, PipelineMessageInput, ProcessMessageDeps, ProcessMessageResult } from "./types";

export function detectAmountMismatch(messages: ExtractionMessageInput[], tolerancePercent: number): boolean {
  const bodyAmounts: number[] = [];
  const attachmentAmounts: number[] = [];

  for (const message of messages) {
    const bodyAmount = findAmountNearAnchor(message.bodyText, ["importo totale", "totale", "importo:"]);
    if (bodyAmount) bodyAmounts.push(bodyAmount.value);
    for (const attachment of message.attachments) {
      if (!attachment.isReadable || !attachment.text) continue;
      const attachmentAmount = findAmountNearAnchor(attachment.text, ["totale"]);
      if (attachmentAmount) attachmentAmounts.push(attachmentAmount.value);
    }
  }

  if (bodyAmounts.length === 0 || attachmentAmounts.length === 0) return false;
  const [bodyValue] = bodyAmounts;
  const [attachmentValue] = attachmentAmounts;
  const diffPercent = (Math.abs(bodyValue - attachmentValue) / Math.max(bodyValue, attachmentValue)) * 100;
  return diffPercent > tolerancePercent;
}

export function readFieldValue(data: Record<string, unknown>, fieldKey: string): unknown {
  const field = data[fieldKey];
  if (field && typeof field === "object" && "value" in field) {
    return (field as { value: unknown }).value;
  }
  return null;
}

export function readFieldSourceMessageId(data: Record<string, unknown>, fieldKey: string): string | null {
  const field = data[fieldKey];
  if (field && typeof field === "object" && "source_message_id" in field) {
    const value = (field as { source_message_id: unknown }).source_message_id;
    return typeof value === "string" ? value : null;
  }
  return null;
}

/**
 * Converte in data assoluta la stringa grezza restituita dal modello per un campo data,
 * risolvendo espressioni relative ("entro N giorni") rispetto al momento in cui è stato
 * ricevuto il messaggio sorgente del campo (non "ora" della pipeline) — vedi
 * `normalizeDateExpression` (SPEC.md §6, Fase 5: normalizzazione deterministica fuori dal
 * modello). Ignora sempre `normalized_value` del modello: solo `value` (testo grezzo) passa
 * dal normalizzatore deterministico.
 */
export function resolveFieldDueAt(value: string, sourceMessageId: string | null, messagesById: Map<string, { receivedAt: string }>, now: Date): Date | null {
  const referenceIso = (sourceMessageId ? messagesById.get(sourceMessageId)?.receivedAt : undefined) ?? now.toISOString();
  const isoDate = normalizeDateExpression(value, { referenceIso });
  if (!isoDate) return null;
  const dueAt = romeMidnightToUtcDate(isoDate);
  return Number.isNaN(dueAt.getTime()) ? null : dueAt;
}

export function deduceDeadlines(
  category: CaseCategory,
  extraction: ExtractionOutcome | null,
  classificationDeadline: string | null,
  now: Date,
  settings: RuleSettingsData,
  messagesById: Map<string, { receivedAt: string }>,
): DeducedDeadline[] {
  const raw: { kind: DeadlineKind; label: string; dueAt: Date }[] = [];
  const data = extraction ? (extraction.result.data as Record<string, unknown>) : null;

  function addFromField(fieldKey: string, kind: DeadlineKind, label: string) {
    if (!data) return;
    const value = readFieldValue(data, fieldKey);
    if (typeof value !== "string") return;
    const sourceMessageId = readFieldSourceMessageId(data, fieldKey);
    const dueAt = resolveFieldDueAt(value, sourceMessageId, messagesById, now);
    if (dueAt) raw.push({ kind, label, dueAt });
  }

  switch (category) {
    case "QUOTE_REQUEST":
      addFromField("response_due_at", "RESPONSE_DUE", "Termine per rispondere al preventivo");
      break;
    case "SUPPLIER_INVOICE":
      addFromField("due_date", "PAYMENT_DUE", "Scadenza pagamento fattura fornitore");
      break;
    case "CUSTOMER_RECEIVABLE":
      addFromField("due_date", "PAYMENT_DUE", "Scadenza pagamento credito cliente");
      break;
    case "FINE_OR_PENALTY":
      addFromField("reduced_payment_due_at", "PAYMENT_REDUCED_DUE", "Scadenza pagamento in misura ridotta");
      addFromField("ordinary_payment_due_at", "PAYMENT_DUE", "Scadenza pagamento ordinario");
      addFromField("appeal_due_at", "APPEAL_DUE", "Termine per il ricorso");
      break;
    case "CLAIM_OR_DAMAGE":
      addFromField("response_due_at", "RESPONSE_DUE", "Termine per rispondere al reclamo");
      break;
    case "TRANSPORT_ORDER":
      addFromField("pickup_datetime", "PICKUP_DUE", "Data ritiro");
      addFromField("delivery_datetime", "DELIVERY_DUE", "Data consegna");
      break;
    default:
      break;
  }

  if (raw.length === 0 && classificationDeadline) {
    const dueAt = resolveFieldDueAt(classificationDeadline, null, messagesById, now);
    if (dueAt) raw.push({ kind: "OTHER", label: "Scadenza rilevata dalla classificazione", dueAt });
  }

  return raw.map((d) => {
    const thresholdHours = d.kind === "PAYMENT_REDUCED_DUE" ? settings.fineReducedDeadlineCriticalWithinHours : settings.deadlineCriticalWithinHours;
    const isCritical = d.dueAt.getTime() - now.getTime() <= thresholdHours * 60 * 60 * 1000;
    return { ...d, isCritical };
  });
}

/**
 * Esegue i tre passaggi della pipeline (SPEC.md §6) più matching (§7) e motore di regole (§8).
 * Funzione pura: nessun import diretto di Prisma, riceve le dipendenze da `deps` — usata sia
 * dall'orchestratore reale sia da `eval/` sia dai test, senza toccare Postgres.
 */
function fallbackClassification(reason: string): LLMResult<ClassificationResult> {
  return {
    data: {
      primary_category: "UNCERTAIN",
      secondary_categories: [],
      short_title: "Classificazione automatica fallita",
      summary: `Il passaggio di classificazione ha restituito un output non valido: ${reason}. Richiede revisione manuale.`,
      action_required: true,
      suggested_actions: [],
      priority: "NORMAL",
      priority_reasons: [],
      deadline: null,
      responsible_department: null,
      customer_or_supplier: null,
      related_business_identifiers: [],
      confidence: 0,
      needs_human_review: true,
      security_flags: [],
    },
    usage: { inputTokens: null, outputTokens: null, costUsd: null },
    model: "fallback",
  };
}

export async function runPipelineForMessage(input: PipelineMessageInput, deps: ProcessMessageDeps): Promise<ProcessMessageResult> {
  const now = deps.now ? deps.now() : new Date();

  // La classificazione può fallire per un output del modello non conforme allo schema (es. un
  // valore enum fuori allowlist, correttamente respinto dalla validazione Zod, CLAUDE.md
  // invariante 6): non deve mai far perdere silenziosamente un'email — si degrada a una
  // classificazione minima UNCERTAIN/needs_human_review, mai un crash dell'intera pipeline.
  let classification: LLMResult<ClassificationResult>;
  try {
    classification = await deps.llmProvider.classify({
      emailMessageId: input.emailMessageId,
      emailSubject: input.subject,
      emailBody: input.bodyText,
      attachments: input.attachments,
    });
  } catch (error) {
    classification = fallbackClassification(error instanceof Error ? error.message : String(error));
  }
  const classificationCategory = classification.data.primary_category;

  const match = await matchEmailToCase(
    {
      mailboxConnectionId: input.mailboxConnectionId,
      providerThreadId: input.providerThreadId,
      internetMessageId: input.internetMessageId,
      inReplyTo: input.inReplyTo,
      references: input.references,
      isPec: input.isPec,
      pecMessageType: input.pecMessageType,
      fromAddress: input.fromAddress,
      subject: input.subject,
      bodyText: input.bodyText,
      receivedAt: input.receivedAt,
      category: classificationCategory,
    },
    deps.caseRepository,
    {
      autoLinkConfidenceThreshold: deps.settings.matchingAutoLinkConfidenceThreshold,
      possibleDuplicateConfidenceThreshold: deps.settings.matchingPossibleDuplicateConfidenceThreshold,
    },
  );

  if (match.isPecReceipt) {
    return { input, now, classification, classificationCategory, match, extraction: null, deadlines: [], ruleOutcome: null, actionProposal: null };
  }

  const currentAsMessageInput: ExtractionMessageInput = {
    emailMessageId: input.emailMessageId,
    subject: input.subject,
    bodyText: input.bodyText,
    receivedAt: input.receivedAt.toISOString(),
    attachments: input.attachments,
  };
  const priorMessages = match.caseId ? await deps.getCaseMessages(match.caseId) : [];
  const allMessages = [...priorMessages, currentAsMessageInput].sort(
    (a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime(),
  );

  let extraction: ExtractionOutcome | null = null;
  if (isExtractableCategory(classificationCategory)) {
    try {
      const extractionResult = await deps.llmProvider.extractFields({
        caseId: match.caseId ?? "",
        category: classificationCategory,
        messages: allMessages,
      });
      extraction = { category: classificationCategory, result: extractionResult };
    } catch (error) {
      throw new PipelineExtractionError(error instanceof Error ? error.message : String(error), match.caseId ?? null);
    }
  }

  const hasUnreadableAttachment = allMessages.some((m) => m.attachments.some((a) => !a.isReadable));
  const messagesById = new Map(allMessages.map((m) => [m.emailMessageId, { receivedAt: m.receivedAt }]));
  const deadlines = deduceDeadlines(classificationCategory, extraction, classification.data.deadline, now, deps.settings, messagesById);

  let ibanMismatch = false;
  if (classificationCategory === "SUPPLIER_INVOICE" && extraction && deps.getSupplierIbanByName) {
    const data = extraction.result.data as Record<string, unknown>;
    const supplierName = readFieldValue(data, "supplier_name");
    const iban = readFieldValue(data, "iban");
    if (typeof supplierName === "string" && typeof iban === "string") {
      const historicalIban = await deps.getSupplierIbanByName(supplierName);
      if (historicalIban && historicalIban !== iban) ibanMismatch = true;
    }
  }

  const amountMismatchDetected = classificationCategory === "SUPPLIER_INVOICE" ? detectAmountMismatch(allMessages, deps.settings.amountMismatchTolerancePercent) : false;

  let claimRequestedAmount: number | null = null;
  if (classificationCategory === "CLAIM_OR_DAMAGE" && extraction) {
    const value = readFieldValue(extraction.result.data as Record<string, unknown>, "requested_amount");
    claimRequestedAmount = typeof value === "number" ? value : null;
  }

  let quoteResponseDueAt: Date | null = null;
  if (classificationCategory === "QUOTE_REQUEST") {
    const data = extraction ? (extraction.result.data as Record<string, unknown>) : null;
    const value = data ? readFieldValue(data, "response_due_at") : null;
    if (typeof value === "string") {
      const sourceMessageId = data ? readFieldSourceMessageId(data, "response_due_at") : null;
      quoteResponseDueAt = resolveFieldDueAt(value, sourceMessageId, messagesById, now);
    }
    if (!quoteResponseDueAt && classification.data.deadline) {
      quoteResponseDueAt = resolveFieldDueAt(classification.data.deadline, null, messagesById, now);
    }
  }

  const ruleContext: RuleContext = {
    category: classificationCategory,
    deadlines: deadlines.map((d) => ({ kind: d.kind, dueAt: d.dueAt })),
    hasUnreadableAttachment,
    possibleDuplicate: Boolean(match.possibleDuplicateOf),
    amountMismatchDetected,
    ibanMismatch,
    claimRequestedAmount,
    quoteResponseDueAt,
    classificationConfidence: classification.data.confidence,
    now,
  };

  const baseline: RuleBaseline = {
    priority: classification.data.priority,
    status: classification.data.needs_human_review ? "NEEDS_REVIEW" : "NEW",
    needsHumanReview: classification.data.needs_human_review,
    reasons: classification.data.priority_reasons,
  };

  const ruleOutcome = applyRules(baseline, ruleContext, deps.settings);

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

  let actionProposal: ProcessMessageResult["actionProposal"] = null;
  let finalRuleOutcome = ruleOutcome;
  try {
    actionProposal = await deps.llmProvider.proposeActions({
      caseId: match.caseId ?? "",
      category: classificationCategory,
      classification: classification.data,
      extractedFieldValues,
    });
  } catch {
    // La proposta azioni è l'ultimo passaggio, puramente di suggerimento (SPEC.md §6): un suo
    // fallimento non deve far perdere classificazione/estrazione/regole già calcolate — la
    // pratica viene comunque creata, segnalata per revisione umana (mai persa silenziosamente).
    finalRuleOutcome = { ...ruleOutcome, status: "NEEDS_REVIEW", needsHumanReview: true };
  }

  return { input, now, classification, classificationCategory, match, extraction, deadlines, ruleOutcome: finalRuleOutcome, actionProposal };
}

async function readAttachmentText(storageKey: string): Promise<string> {
  const buffer = await attachmentStorage.get(storageKey);
  return buffer.toString("utf-8");
}

async function loadPipelineMessageInput(emailMessageId: string): Promise<PipelineMessageInput> {
  const message = await prisma.emailMessage.findUniqueOrThrow({
    where: { id: emailMessageId },
    include: { attachments: true, thread: true },
  });

  const attachments = await Promise.all(
    message.attachments.map(async (a) => ({
      attachmentId: a.id,
      fileName: a.fileName,
      isReadable: a.isReadable,
      text: a.isReadable ? await readAttachmentText(a.storageKey) : null,
    })),
  );

  return {
    mailboxConnectionId: message.mailboxConnectionId,
    emailMessageId: message.id,
    providerThreadId: message.thread.providerThreadId ?? message.threadId,
    internetMessageId: message.internetMessageId,
    inReplyTo: message.inReplyTo,
    references: message.references,
    isPec: message.isPec,
    pecMessageType: message.pecMessageType,
    fromAddress: message.fromAddress,
    subject: message.subject,
    bodyText: message.bodyText,
    receivedAt: message.receivedAt,
    attachments,
  };
}

export async function loadCaseMessages(caseId: string): Promise<ExtractionMessageInput[]> {
  const messages = await prisma.emailMessage.findMany({
    where: { caseId },
    include: { attachments: true },
    orderBy: { receivedAt: "asc" },
  });

  return Promise.all(
    messages.map(async (m) => ({
      emailMessageId: m.id,
      subject: m.subject,
      bodyText: m.bodyText,
      receivedAt: m.receivedAt.toISOString(),
      attachments: await Promise.all(
        m.attachments.map(async (a) => ({
          attachmentId: a.id,
          fileName: a.fileName,
          isReadable: a.isReadable,
          text: a.isReadable ? await readAttachmentText(a.storageKey) : null,
        })),
      ),
    })),
  );
}

async function lookupSupplierIbanByName(name: string): Promise<string | null> {
  const supplier = await prisma.supplier.findFirst({ where: { name } });
  return supplier?.iban ?? null;
}

/**
 * Wrapper Prisma: legge il messaggio (sola lettura), esegue la pipeline pura, poi scrive tutto
 * in un'unica transazione. Le chiamate LLM restano SEMPRE fuori dalla transazione — mai tenere
 * aperta una transazione Postgres durante una chiamata di rete.
 */
export async function processIncomingMessage(emailMessageId: string): Promise<ProcessMessageResult> {
  const input = await loadPipelineMessageInput(emailMessageId);

  const deps: ProcessMessageDeps = {
    llmProvider: getCachedLLMProvider(),
    caseRepository: new PrismaCaseRepository(prisma),
    settings: await getRuleSettings(),
    getCaseMessages: loadCaseMessages,
    getSupplierIbanByName: lookupSupplierIbanByName,
  };

  let result: ProcessMessageResult;
  try {
    result = await runPipelineForMessage(input, deps);
  } catch (error) {
    if (error instanceof PipelineExtractionError) {
      await prisma.$transaction(async (tx) => {
        if (error.caseId) {
          await tx.extractionRun.create({
            data: { caseId: error.caseId, llmProvider: deps.llmProvider.providerName, status: "FAILED", errorMessage: error.message },
          });
        } else {
          await tx.extractionRun.create({
            data: { llmProvider: deps.llmProvider.providerName, status: "FAILED", errorMessage: error.message },
          });
        }
        await writeAuditLog(tx, {
          action: "EXTRACTION_ERROR",
          entityType: "EmailMessage",
          entityId: emailMessageId,
          caseId: error.caseId ?? undefined,
          metadata: { error: error.message },
        });
      });
      throw error;
    }

    await prisma.$transaction(async (tx) => {
      await tx.classificationRun.create({
        data: {
          emailMessageId,
          llmProvider: deps.llmProvider.providerName,
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
      await writeAuditLog(tx, {
        action: "CLASSIFICATION_ERROR",
        entityType: "EmailMessage",
        entityId: emailMessageId,
        metadata: { error: error instanceof Error ? error.message : String(error) },
      });
    });
    throw error;
  }

  if (result.match.isPecReceipt && !result.match.caseId) {
    await prisma.$transaction(async (tx) => {
      await writeAuditLog(tx, {
        action: "CLASSIFICATION_ERROR",
        entityType: "EmailMessage",
        entityId: emailMessageId,
        metadata: { reason: "Ricevuta PEC non risolvibile al messaggio originale: nessuna pratica collegata automaticamente." },
      });
    });
    return result;
  }

  await prisma.$transaction(async (tx) => {
    const { caseId } = await persistClassification(tx, deps.llmProvider.providerName, result);
    await persistExtraction(tx, deps.llmProvider.providerName, caseId, result);
    await persistActions(tx, deps.llmProvider.providerName, caseId, result);
  });

  return result;
}
