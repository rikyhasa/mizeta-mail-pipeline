import type {
  ActionProposalInput,
  AttachmentVisionExtractionInput,
  ClassificationInput,
  DraftGenerationInput,
  EnforcementDeviceAnalysisInput,
  ExtractionInput,
  LLMProvider,
  LLMResult,
} from "@/lib/adapters/llm/types";
import type { ClassificationResult } from "@/lib/adapters/llm/schemas";
import type { ExtractableCategory, ExtractionResultFor } from "@/lib/adapters/llm/schemas/extraction-index";
import type { ProposeActionsResult } from "@/lib/adapters/llm/schemas/actions";
import type { DraftGenerationResult } from "@/lib/adapters/llm/schemas/draft";
import type { EnforcementDeviceAnalysisResult } from "@/lib/adapters/llm/schemas/enforcement-device-analysis";
import type { AttachmentVisionExtractionResult } from "@/lib/adapters/llm/schemas/attachment-vision-extraction";

const NOT_IMPLEMENTED = "OpenAILLMProvider non implementato in questa fase: solo interfaccia/scheletro documentato.";

/**
 * Scheletro documentato, NON funzionante in questa fase — stesso pattern del `pec_imap`
 * mail adapter di Fase 1 (interfaccia completa, implementazione assente). `getLLMProvider()`
 * fallisce esplicitamente prima di arrivare a chiamare questi metodi.
 */
export class OpenAILLMProvider implements LLMProvider {
  readonly providerName = "openai" as const;

  async classify(_input: ClassificationInput): Promise<LLMResult<ClassificationResult>> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async extractFields<C extends ExtractableCategory>(_input: ExtractionInput<C>): Promise<LLMResult<ExtractionResultFor<C>>> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async analyzeEnforcementDevice(_input: EnforcementDeviceAnalysisInput): Promise<LLMResult<EnforcementDeviceAnalysisResult>> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async proposeActions(_input: ActionProposalInput): Promise<LLMResult<ProposeActionsResult>> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async generateDraft(_input: DraftGenerationInput): Promise<LLMResult<DraftGenerationResult>> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async extractAttachmentVisionText(_input: AttachmentVisionExtractionInput): Promise<LLMResult<AttachmentVisionExtractionResult>> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async healthCheck(): Promise<{ ok: boolean; provider: string }> {
    return { ok: false, provider: "openai" };
  }
}
