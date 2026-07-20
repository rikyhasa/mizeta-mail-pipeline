import type { ClassificationResult } from "@/lib/adapters/llm/schemas";
import type { ExtractableCategory, ExtractionResultFor } from "@/lib/adapters/llm/schemas/extraction-index";
import type { ProposeActionsResult } from "@/lib/adapters/llm/schemas/actions";
import type { DraftGenerationResult } from "@/lib/adapters/llm/schemas/draft";
import type { EnforcementDeviceAnalysisResult } from "@/lib/adapters/llm/schemas/enforcement-device-analysis";
import type { AttachmentVisionExtractionResult } from "@/lib/adapters/llm/schemas/attachment-vision-extraction";
import type { CaseCategory } from "@/generated/prisma/enums";

export interface AttachmentInput {
  attachmentId: string;
  fileName: string;
  isReadable: boolean;
  /** null se isReadable=false: il contenuto non deve mai essere letto o inventato. */
  text: string | null;
  /** Campi mappati da un parser strutturato (es. XML FatturaPA, FASE 10), fieldKey -> valore
   * grezzo. Presente solo per gli allegati estratti al livello STRUCTURED. */
  structuredFields?: Record<string, string | number | boolean> | null;
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

/**
 * Livello 3 di estrazione allegati (FASE 10, docs/FASE-10-LETTURA-ALLEGATI.md): usato solo
 * quando l'estrazione locale del testo (livello 2) non è disponibile o è insufficiente, o per
 * immagini. Non uno dei passaggi ufficiali della pipeline AI (SPEC.md §6) — un pre-processing
 * che precede la classificazione.
 */
export interface AttachmentVisionExtractionInput {
  attachmentId: string;
  fileName: string;
  /** Solo i formati supportati dall'input multimodale del provider (PDF, jpeg/png/gif/webp). */
  mimeType: "application/pdf" | "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  contentBase64: string;
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

  /** Estrazione visione degli allegati, livello 3 (FASE 10, docs/FASE-10-LETTURA-ALLEGATI.md) —
   * non uno dei passaggi ufficiali sopra, un pre-processing che li precede. */
  extractAttachmentVisionText(input: AttachmentVisionExtractionInput): Promise<LLMResult<AttachmentVisionExtractionResult>>;

  healthCheck(): Promise<{ ok: boolean; provider: string }>;
}
