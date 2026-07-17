import type { ClassificationResult } from "@/lib/adapters/llm/schemas";
import type { ExtractableCategory, ExtractionResultFor } from "@/lib/adapters/llm/schemas/extraction-index";
import type { ProposeActionsResult } from "@/lib/adapters/llm/schemas/actions";
import type { DraftGenerationResult } from "@/lib/adapters/llm/schemas/draft";
import type { EnforcementDeviceAnalysisResult } from "@/lib/adapters/llm/schemas/enforcement-device-analysis";
import type { CaseCategory } from "@/generated/prisma/enums";

export interface AttachmentInput {
  attachmentId: string;
  fileName: string;
  isReadable: boolean;
  /** null se isReadable=false: il contenuto non deve mai essere letto o inventato. */
  text: string | null;
}

export interface ClassificationInput {
  emailMessageId: string;
  emailSubject: string;
  emailBody: string;
  attachments: AttachmentInput[];
}

export interface ExtractionMessageInput {
  emailMessageId: string;
  subject: string;
  bodyText: string;
  receivedAt: string;
  attachments: AttachmentInput[];
}

export interface ExtractionInput<C extends ExtractableCategory = ExtractableCategory> {
  caseId: string;
  category: C;
  /** Tutti i messaggi noti della pratica, ordinati per data crescente: l'estrazione aggrega più messaggi. */
  messages: ExtractionMessageInput[];
}

export interface ActionProposalInput {
  caseId: string;
  category: CaseCategory;
  classification: ClassificationResult;
  /** Campi già estratti (fieldKey -> valore). Mai testo grezzo dell'email in questo passaggio. */
  extractedFieldValues: Record<string, string | number | boolean | null>;
}

/** Solo per pratiche già classificate FINE_OR_PENALTY (docs/SPEC-AUTOVELOX-DRAFT.md §4, §6) —
 * un passaggio separato dall'estrazione principale, non una variante di ExtractionInput. */
export interface EnforcementDeviceAnalysisInput {
  caseId: string;
  messages: ExtractionMessageInput[];
}

export interface DraftGenerationInput {
  caseId: string;
  category: CaseCategory;
  /** Sintesi già prodotta dalla classificazione — mai il corpo grezzo dell'email in questo passaggio. */
  classificationSummary: string | null;
  /** Campi già estratti (fieldKey -> valore), stesso contratto di ActionProposalInput. */
  extractedFieldValues: Record<string, string | number | boolean | null>;
  /** Scheletro opzionale da un ReplyTemplate: se assente il provider usa un default per categoria. */
  templateSubject: string | null;
  templateBody: string | null;
}

export interface LLMUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
}

export interface LLMResult<T> {
  data: T;
  usage: LLMUsage;
  model: string;
}

/**
 * Common interface for classification/extraction/action-proposal (SPEC.md §6, §13). Tre
 * passaggi separati, mai un unico prompt. `anthropic` è l'unico provider reale implementato in
 * Fase 2; `openai` resta uno scheletro documentato non funzionante (stesso pattern di
 * `pec_imap` in Fase 1); `mock` implementa un motore euristico reale, non canned.
 */
export interface LLMProvider {
  readonly providerName: "anthropic" | "openai" | "mock";

  classify(input: ClassificationInput): Promise<LLMResult<ClassificationResult>>;

  extractFields<C extends ExtractableCategory>(input: ExtractionInput<C>): Promise<LLMResult<ExtractionResultFor<C>>>;

  /** Applicabilità del modulo di verifica autovelox + dati tecnici del dispositivo
   * (docs/SPEC-AUTOVELOX-DRAFT.md §4, §6) — passaggio separato, solo per FINE_OR_PENALTY. */
  analyzeEnforcementDevice(input: EnforcementDeviceAnalysisInput): Promise<LLMResult<EnforcementDeviceAnalysisResult>>;

  proposeActions(input: ActionProposalInput): Promise<LLMResult<ProposeActionsResult>>;

  /** Generazione bozza di risposta (SPEC.md §11): mai inviata, richiede sempre approvazione umana esplicita. */
  generateDraft(input: DraftGenerationInput): Promise<LLMResult<DraftGenerationResult>>;

  healthCheck(): Promise<{ ok: boolean; provider: string }>;
}
