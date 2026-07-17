import type { CaseCategory, DeadlineKind, PecMessageType } from "@/generated/prisma/enums";
import type { ClassificationResult } from "@/lib/adapters/llm/schemas";
import type { ProposeActionsResult } from "@/lib/adapters/llm/schemas/actions";
import type { ExtractableCategory, ExtractionResultFor } from "@/lib/adapters/llm/schemas/extraction-index";
import type { EnforcementDeviceAnalysisResult } from "@/lib/adapters/llm/schemas/enforcement-device-analysis";
import type { AttachmentInput, ExtractionMessageInput, LLMProvider, LLMResult } from "@/lib/adapters/llm/types";
import type { CaseRepository, MatchResult } from "@/lib/matching/types";
import type { RuleEngineResult, RuleSettingsData } from "@/lib/rules/types";

export interface PipelineMessageInput {
  mailboxConnectionId: string;
  emailMessageId: string;
  providerThreadId: string;
  internetMessageId: string | null;
  inReplyTo: string | null;
  references: string[];
  isPec: boolean;
  pecMessageType: PecMessageType | null;
  fromAddress: string;
  subject: string;
  bodyText: string;
  receivedAt: Date;
  attachments: AttachmentInput[];
}

export interface ProcessMessageDeps {
  llmProvider: LLMProvider;
  caseRepository: CaseRepository;
  settings: RuleSettingsData;
  /** Messaggi già noti di una pratica esistente (per aggregare l'estrazione, SPEC.md §6). */
  getCaseMessages: (caseId: string) => Promise<ExtractionMessageInput[]>;
  /** Ricerca IBAN storico del fornitore per la rule "iban_mismatch"; opzionale (mock/eval: sempre assente). */
  getSupplierIbanByName?: (supplierName: string) => Promise<string | null>;
  now?: () => Date;
}

export interface DeducedDeadline {
  kind: DeadlineKind;
  label: string;
  dueAt: Date;
  isCritical: boolean;
}

export interface ExtractionOutcome<C extends ExtractableCategory = ExtractableCategory> {
  category: C;
  result: LLMResult<ExtractionResultFor<C>>;
}

/**
 * Distingue un fallimento del passaggio di estrazione (SPEC.md §6, terzo passaggio) da un
 * fallimento di classificazione — `processIncomingMessage` scrive un `ExtractionRun` FAILED e
 * un audit `EXTRACTION_ERROR` invece di `CLASSIFICATION_ERROR`. `caseId` è quello già risolto
 * dal matching (può essere `null` per una pratica non ancora creata: la creazione avviene solo
 * nella transazione di persistenza, mai raggiunta se l'estrazione lancia).
 */
export class PipelineExtractionError extends Error {
  readonly caseId: string | null;

  constructor(message: string, caseId: string | null) {
    super(message);
    this.name = "PipelineExtractionError";
    this.caseId = caseId;
  }
}

export interface ProcessMessageResult {
  input: PipelineMessageInput;
  now: Date;
  classification: LLMResult<ClassificationResult>;
  classificationCategory: CaseCategory;
  match: MatchResult;
  extraction: ExtractionOutcome | null;
  deadlines: DeducedDeadline[];
  ruleOutcome: RuleEngineResult | null;
  actionProposal: LLMResult<ProposeActionsResult> | null;
  /** Solo per FINE_OR_PENALTY con estrazione riuscita (docs/SPEC-AUTOVELOX-DRAFT.md §4, §6). */
  enforcementDeviceAnalysis: LLMResult<EnforcementDeviceAnalysisResult> | null;
}
