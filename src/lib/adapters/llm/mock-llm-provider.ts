import { classificationResultSchema, type ClassificationResult } from "@/lib/adapters/llm/schemas";
import { extractionSchemaForCategory, type ExtractableCategory, type ExtractionResultFor } from "@/lib/adapters/llm/schemas/extraction-index";
import { proposeActionsResultSchema, type ProposeActionsResult } from "@/lib/adapters/llm/schemas/actions";
import { draftGenerationResultSchema, type DraftGenerationResult } from "@/lib/adapters/llm/schemas/draft";
import { enforcementDeviceAnalysisSchema, type EnforcementDeviceAnalysisResult } from "@/lib/adapters/llm/schemas/enforcement-device-analysis";
import type {
  ActionProposalInput,
  ClassificationInput,
  DraftGenerationInput,
  EnforcementDeviceAnalysisInput,
  ExtractionInput,
  LLMProvider,
  LLMResult,
} from "@/lib/adapters/llm/types";
import { classifyHeuristically } from "@/lib/adapters/llm/mock/classify-heuristics";
import { extractHeuristically } from "@/lib/adapters/llm/mock/extract-heuristics";
import { analyzeEnforcementDeviceHeuristically } from "@/lib/adapters/llm/mock/analyze-enforcement-device-heuristics";
import { proposeActionsHeuristically } from "@/lib/adapters/llm/mock/propose-actions-heuristics";
import { generateDraftHeuristically } from "@/lib/adapters/llm/mock/generate-draft-heuristics";

const MOCK_MODEL_NAME = "mock-heuristic-v1";
const NO_USAGE = { inputTokens: null, outputTokens: null, costUsd: null };

/**
 * Motore euristico reale (keyword scoring + regex, SPEC.md §4): niente costo, niente rete,
 * deterministico. Non risponde per ID hard-coded — analizza davvero il testo, così l'eval
 * (`npm run eval`) misura qualcosa di significativo. Coerente con l'invariante 1: pattern
 * matching su stringa, nessuna azione mai eseguita in base al contenuto dell'email.
 */
export class MockLLMProvider implements LLMProvider {
  readonly providerName = "mock" as const;

  constructor(private readonly classificationConfidenceThreshold: number = 0.55) {}

  async classify(input: ClassificationInput): Promise<LLMResult<ClassificationResult>> {
    const result = classifyHeuristically(input, this.classificationConfidenceThreshold);
    const data = classificationResultSchema.parse(result);
    return { data, usage: NO_USAGE, model: MOCK_MODEL_NAME };
  }

  async extractFields<C extends ExtractableCategory>(input: ExtractionInput<C>): Promise<LLMResult<ExtractionResultFor<C>>> {
    const raw = extractHeuristically(input.category, input.messages);
    const schema = extractionSchemaForCategory(input.category);
    const data = schema.parse(raw) as ExtractionResultFor<C>;
    return { data, usage: NO_USAGE, model: MOCK_MODEL_NAME };
  }

  async analyzeEnforcementDevice(input: EnforcementDeviceAnalysisInput): Promise<LLMResult<EnforcementDeviceAnalysisResult>> {
    const raw = analyzeEnforcementDeviceHeuristically(input.messages);
    const data = enforcementDeviceAnalysisSchema.parse(raw);
    return { data, usage: NO_USAGE, model: MOCK_MODEL_NAME };
  }

  async proposeActions(input: ActionProposalInput): Promise<LLMResult<ProposeActionsResult>> {
    const raw = proposeActionsHeuristically(input);
    const data = proposeActionsResultSchema.parse(raw);
    return { data, usage: NO_USAGE, model: MOCK_MODEL_NAME };
  }

  async generateDraft(input: DraftGenerationInput): Promise<LLMResult<DraftGenerationResult>> {
    const raw = generateDraftHeuristically(input);
    const data = draftGenerationResultSchema.parse(raw);
    return { data, usage: NO_USAGE, model: MOCK_MODEL_NAME };
  }

  async healthCheck(): Promise<{ ok: boolean; provider: string }> {
    return { ok: true, provider: "mock" };
  }
}

export const mockLLMProvider = new MockLLMProvider();
