import type { CaseCategory, CasePriority, CaseStatus } from "@/generated/prisma/enums";
import type { LLMProvider } from "@/lib/adapters/llm/types";
import { InMemoryCaseRepository } from "@/lib/matching/in-memory-case-repository";
import { runPipelineForMessage } from "@/lib/pipeline/process-incoming-message";
import type { PipelineMessageInput, ProcessMessageResult } from "@/lib/pipeline/types";
import { DEFAULT_RULE_SETTINGS } from "@/lib/rules/default-settings";
import { SEED_EMAILS, type SeedEmailFixture } from "../prisma/seed-data/emails";
import type { EvalRecord } from "./metrics";

function fixtureToPipelineInput(fixture: SeedEmailFixture): PipelineMessageInput {
  return {
    mailboxConnectionId: fixture.mailbox,
    emailMessageId: fixture.id,
    providerThreadId: fixture.threadKey,
    internetMessageId: fixture.internetMessageId,
    inReplyTo: fixture.inReplyTo ?? null,
    references: fixture.inReplyTo ? [fixture.inReplyTo] : [],
    isPec: fixture.isPec,
    pecMessageType: fixture.pecMessageType ?? null,
    fromAddress: fixture.from.address,
    subject: fixture.subject,
    bodyText: fixture.bodyText,
    receivedAt: new Date(fixture.receivedAt),
    attachments: (fixture.attachments ?? []).map((a) => ({
      attachmentId: a.id,
      fileName: a.fileName,
      isReadable: a.isReadable,
      text: a.isReadable ? a.contentPreviewText : null,
    })),
  };
}

const PRIORITY_ORDER: CasePriority[] = ["LOW", "NORMAL", "HIGH", "CRITICAL"];
function escalate(a: CasePriority, b: CasePriority): CasePriority {
  return PRIORITY_ORDER.indexOf(b) > PRIORITY_ORDER.indexOf(a) ? b : a;
}

interface EvalCase {
  category: CaseCategory;
  priority: CasePriority;
  status: CaseStatus;
  needsHumanReview: boolean;
  fields: Record<string, unknown>;
  securityFlags: Set<string>;
  possibleDuplicateFlagged: boolean;
}

function extractFieldValues(dataRaw: unknown): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(dataRaw as Record<string, unknown>)) {
    if (raw && typeof raw === "object" && "value" in raw) values[key] = (raw as { value: unknown }).value;
  }
  return values;
}

export interface RunEvalOptions {
  /** Chiamata dopo ogni fixture processata: utile per loggare progresso su provider lenti/a pagamento. */
  onFixtureDone?: (fixtureId: string, index: number, total: number) => void;
  /** Chiamata con il ProcessMessageResult grezzo di ogni fixture: utile per estrarre usage/costo senza cambiare EvalRecord. */
  onResult?: (fixtureId: string, result: ProcessMessageResult) => void;
  /** Se una fixture fallisce (es. errore di rete transitorio su un provider reale), viene saltata invece di abortire l'intero run. */
  onError?: (fixtureId: string, error: unknown) => void;
}

/**
 * Esegue l'intero dataset di fixture attraverso la pipeline reale (matching + regole + il
 * provider LLM passato) e produce gli EvalRecord per `computeMetrics`. Mai Postgres — usa
 * `InMemoryCaseRepository` — così è riusabile sia dall'eval ufficiale (sempre mock, costo zero)
 * sia da script separati che confrontano il mock con un provider reale (costo reale a carico di
 * chi lo esegue esplicitamente).
 */
export async function runEvalWithProvider(llmProvider: LLMProvider, options: RunEvalOptions = {}): Promise<EvalRecord[]> {
  const caseRepository = new InMemoryCaseRepository();
  const evalCases = new Map<string, EvalCase>();
  const records: EvalRecord[] = [];
  let caseCounter = 0;

  const orderedFixtures = [...SEED_EMAILS].sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime());

  for (let i = 0; i < orderedFixtures.length; i += 1) {
    const fixture = orderedFixtures[i];
    const input = fixtureToPipelineInput(fixture);
    try {
      const result = await runPipelineForMessage(input, {
        llmProvider,
        caseRepository,
        settings: DEFAULT_RULE_SETTINGS,
        getCaseMessages: (caseId) => caseRepository.getCaseMessages(caseId),
        now: () => input.receivedAt,
      });
      options.onResult?.(fixture.id, result);

      if (result.match.isPecReceipt) {
        const evalCase = result.match.caseId ? evalCases.get(result.match.caseId) : undefined;
        records.push({
          fixtureId: fixture.id,
          category: evalCase?.category ?? result.classificationCategory,
          priority: evalCase?.priority ?? result.classification.data.priority,
          needsHumanReview: evalCase?.needsHumanReview ?? true,
          securityFlags: evalCase ? [...evalCase.securityFlags] : result.classification.data.security_flags,
          isPossibleDuplicateFlagged: evalCase?.possibleDuplicateFlagged ?? false,
          fields: evalCase?.fields ?? {},
          receivedAt: input.receivedAt.toISOString(),
        });
        options.onFixtureDone?.(fixture.id, i + 1, orderedFixtures.length);
        continue;
      }

      const caseId = result.match.caseId ?? `eval-case-${++caseCounter}`;
      const extractedFieldValues = result.extraction ? extractFieldValues(result.extraction.result.data) : {};
      let evalCase = evalCases.get(caseId);

      if (!evalCase) {
        evalCase = {
          category: result.classificationCategory,
          priority: result.ruleOutcome?.priority ?? result.classification.data.priority,
          status: result.ruleOutcome?.status ?? "NEW",
          needsHumanReview: result.ruleOutcome?.needsHumanReview ?? result.classification.data.needs_human_review,
          fields: extractedFieldValues,
          securityFlags: new Set(result.classification.data.security_flags),
          possibleDuplicateFlagged: Boolean(result.match.possibleDuplicateOf),
        };
        evalCases.set(caseId, evalCase);
      } else {
        evalCase.priority = escalate(evalCase.priority, result.ruleOutcome?.priority ?? evalCase.priority);
        evalCase.needsHumanReview = evalCase.needsHumanReview || (result.ruleOutcome?.needsHumanReview ?? false);
        evalCase.fields = { ...evalCase.fields, ...extractedFieldValues };
        for (const flag of result.classification.data.security_flags) evalCase.securityFlags.add(flag);
        if (result.match.possibleDuplicateOf) evalCase.possibleDuplicateFlagged = true;
      }

      const strField = (key: string) => (typeof extractedFieldValues[key] === "string" ? [extractedFieldValues[key] as string] : []);
      await caseRepository.recordCase({
        caseId,
        category: evalCase.category,
        title: result.classification.data.short_title,
        summary: result.classification.data.summary,
        invoiceNumbers: strField("invoice_number"),
        orderNumbers: strField("order_number"),
        shipmentReferences: strField("shipment_or_trip_reference"),
        fineNoticeNumbers: strField("notice_number"),
      });
      await caseRepository.recordMessage({
        caseId,
        emailMessageId: fixture.id,
        mailboxConnectionId: input.mailboxConnectionId,
        providerThreadId: input.providerThreadId,
        internetMessageId: input.internetMessageId,
        subject: input.subject,
        bodyText: input.bodyText,
        fromAddress: input.fromAddress,
        receivedAt: input.receivedAt,
        attachments: input.attachments,
      });

      records.push({
        fixtureId: fixture.id,
        category: evalCase.category,
        priority: evalCase.priority,
        needsHumanReview: evalCase.needsHumanReview,
        securityFlags: [...evalCase.securityFlags],
        isPossibleDuplicateFlagged: evalCase.possibleDuplicateFlagged,
        fields: evalCase.fields,
        receivedAt: input.receivedAt.toISOString(),
      });
      options.onFixtureDone?.(fixture.id, i + 1, orderedFixtures.length);
    } catch (error) {
      options.onError?.(fixture.id, error);
    }
  }

  return records;
}
