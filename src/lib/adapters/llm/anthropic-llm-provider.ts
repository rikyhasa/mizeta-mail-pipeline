import Anthropic from "@anthropic-ai/sdk";
import { classificationResultSchema, type ClassificationResult } from "@/lib/adapters/llm/schemas";
import {
  extractionSchemaForCategory,
  EXTRACTION_SCHEMA_PARTS_BY_CATEGORY,
  type ExtractableCategory,
  type ExtractionResultFor,
} from "@/lib/adapters/llm/schemas/extraction-index";
import { proposeActionsResultSchema, type ProposeActionsResult } from "@/lib/adapters/llm/schemas/actions";
import { draftGenerationResultSchema, type DraftGenerationResult } from "@/lib/adapters/llm/schemas/draft";
import { enforcementDeviceAnalysisSchema, type EnforcementDeviceAnalysisResult } from "@/lib/adapters/llm/schemas/enforcement-device-analysis";
import { attachmentVisionExtractionSchema, type AttachmentVisionExtractionResult } from "@/lib/adapters/llm/schemas/attachment-vision-extraction";
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
import { callStructured } from "@/lib/adapters/llm/anthropic/structured-output";
import {
  buildActionProposalSystemPrompt,
  buildActionProposalUserContent,
  buildAttachmentVisionSystemPrompt,
  buildClassificationSystemPrompt,
  buildClassificationUserContent,
  buildDraftGenerationSystemPrompt,
  buildDraftGenerationUserContent,
  buildEnforcementDeviceAnalysisSystemPrompt,
  buildExtractionSystemPrompt,
  buildExtractionUserContent,
} from "@/lib/adapters/llm/anthropic/prompts";

/**
 * Provider Anthropic reale (SPEC.md §6, §13). Nessuna delle tre chiamate passa mai `tools[]`:
 * il modello non ha mai capacità di tool-call, qualunque cosa contenga l'email — mitigazione
 * strutturale, non solo prompt. Ogni risposta è ri-validata server-side con lo schema Zod
 * corrispondente (CLAUDE.md invariante 6).
 */
export class AnthropicLLMProvider implements LLMProvider {
  readonly providerName = "anthropic" as const;
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(opts: { apiKey: string; model: string }) {
    // maxRetries più alto del default SDK (2): un burst di email reali o un run di eval su molte
    // fixture può incontrare rate limit temporanei (429) — l'SDK fa già backoff esponenziale
    // rispettando l'header retry-after, 2 tentativi spesso non bastano a superare la finestra.
    // Senza questo, un 429 propaga come errore generico e la pipeline degrada silenziosamente a
    // UNCERTAIN/needs_human_review (CLAUDE.md: mai perdere un'email, ma è un fallback peggiore
    // di un retry riuscito).
    this.client = new Anthropic({ apiKey: opts.apiKey, maxRetries: 6 });
    this.model = opts.model;
  }

  async classify(input: ClassificationInput): Promise<LLMResult<ClassificationResult>> {
    const { data, usage, model } = await callStructured(this.client, {
      model: this.model,
      system: buildClassificationSystemPrompt(),
      userContent: buildClassificationUserContent(input),
      schema: classificationResultSchema,
      maxTokens: 1536,
    });
    return { data, usage, model };
  }

  /**
   * Alcuni schemi di estrazione superano il limite empirico di complessità dello Structured
   * Output di Anthropic in un'unica chiamata (SPEC.md §6, vedi extraction-index.ts): questo
   * metodo itera le parti dichiarate per la categoria (1 sola parte = nessuno split necessario),
   * unisce i risultati e ri-valida il merge contro lo schema completo prima di restituirlo.
   */
  async extractFields<C extends ExtractableCategory>(input: ExtractionInput<C>): Promise<LLMResult<ExtractionResultFor<C>>> {
    const fullSchema = extractionSchemaForCategory(input.category);
    const parts = EXTRACTION_SCHEMA_PARTS_BY_CATEGORY[input.category];
    const system = buildExtractionSystemPrompt(input.category);
    const userContent = buildExtractionUserContent(input.messages);

    let merged: Record<string, unknown> = {};
    let inputTokens = 0;
    let outputTokens = 0;
    let costUsd = 0;
    let hasCost = false;
    let lastModel = this.model;

    for (const partSchema of parts) {
      const { data, usage, model } = await callStructured(this.client, {
        model: this.model,
        system,
        userContent,
        schema: partSchema,
        maxTokens: 3072,
      });
      merged = { ...merged, ...(data as Record<string, unknown>) };
      inputTokens += usage.inputTokens ?? 0;
      outputTokens += usage.outputTokens ?? 0;
      if (usage.costUsd !== null) {
        costUsd += usage.costUsd;
        hasCost = true;
      }
      lastModel = model;
    }

    const data = fullSchema.parse(merged) as ExtractionResultFor<C>;
    return {
      data,
      usage: { inputTokens, outputTokens, costUsd: hasCost ? costUsd : null },
      model: lastModel,
    };
  }

  async analyzeEnforcementDevice(input: EnforcementDeviceAnalysisInput): Promise<LLMResult<EnforcementDeviceAnalysisResult>> {
    const { data, usage, model } = await callStructured(this.client, {
      model: this.model,
      system: buildEnforcementDeviceAnalysisSystemPrompt(),
      userContent: buildExtractionUserContent(input.messages),
      schema: enforcementDeviceAnalysisSchema,
      maxTokens: 2048,
    });
    return { data, usage, model };
  }

  async proposeActions(input: ActionProposalInput): Promise<LLMResult<ProposeActionsResult>> {
    const { data, usage, model } = await callStructured(this.client, {
      model: this.model,
      system: buildActionProposalSystemPrompt(),
      userContent: buildActionProposalUserContent(input),
      schema: proposeActionsResultSchema,
      maxTokens: 1536,
    });
    return { data, usage, model };
  }

  async generateDraft(input: DraftGenerationInput): Promise<LLMResult<DraftGenerationResult>> {
    const { data, usage, model } = await callStructured(this.client, {
      model: this.model,
      system: buildDraftGenerationSystemPrompt(),
      userContent: buildDraftGenerationUserContent(input),
      schema: draftGenerationResultSchema,
      maxTokens: 1536,
    });
    return { data, usage, model };
  }

  /**
   * Livello 3 di estrazione allegati (FASE 10, docs/FASE-10-LETTURA-ALLEGATI.md): il PDF/
   * immagine viene passato direttamente come content block `document`/`image` in base64 —
   * nessuna rasterizzazione lato server, Claude legge nativamente il documento. Stesso
   * pattern di `callStructured` per il resto: mai `tools[]`, sempre ri-validato con lo schema
   * Zod. `userContent` qui è un array di content block, non una stringa (vedi
   * `StructuredCallParams.userContent`).
   */
  async extractAttachmentVisionText(input: AttachmentVisionExtractionInput): Promise<LLMResult<AttachmentVisionExtractionResult>> {
    const source =
      input.mimeType === "application/pdf"
        ? ({ type: "document" as const, source: { type: "base64" as const, media_type: input.mimeType, data: input.contentBase64 } })
        : ({ type: "image" as const, source: { type: "base64" as const, media_type: input.mimeType, data: input.contentBase64 } });

    const { data, usage, model } = await callStructured(this.client, {
      model: this.model,
      system: buildAttachmentVisionSystemPrompt(),
      userContent: [{ type: "text", text: `ATTACHMENT_CONTENT[id=${input.attachmentId} file=${input.fileName}]` }, source],
      schema: attachmentVisionExtractionSchema,
      maxTokens: 4096,
    });
    return { data, usage, model };
  }

  async healthCheck(): Promise<{ ok: boolean; provider: string }> {
    try {
      await this.client.models.retrieve(this.model);
      return { ok: true, provider: "anthropic" };
    } catch {
      return { ok: false, provider: "anthropic" };
    }
  }
}
