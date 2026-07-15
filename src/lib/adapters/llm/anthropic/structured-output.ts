import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import type { LLMUsage } from "@/lib/adapters/llm/types";

const PRICING_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 3.0, output: 15.0 },
  "claude-opus-4-8": { input: 5.0, output: 25.0 },
};

export function computeCostUsd(model: string, inputTokens: number | null, outputTokens: number): number | null {
  const pricing = PRICING_USD_PER_MTOK[model];
  if (!pricing || inputTokens === null) return null;
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

export interface StructuredCallParams<T extends z.ZodTypeAny> {
  model: string;
  system: string;
  userContent: string;
  schema: T;
  maxTokens?: number;
}

export interface StructuredCallResult<T> {
  data: T;
  usage: LLMUsage;
  model: string;
}

/**
 * Structured Output via `client.messages.parse()` + `output_config.format` (zodOutputFormat) —
 * MAI tool-use forzato: nessun `tools[]` passato, così il modello non ha mai capacità di
 * tool-call qualunque cosa contenga l'email (mitigazione strutturale di SPEC.md §13). Ri-valida
 * esplicitamente il risultato con lo schema Zod anche dopo `.parse()` (CLAUDE.md invariante 6).
 *
 * Un singolo retry se `.parse()` fallisce (JSON malformato o valore fuori allowlist): verificato
 * con chiamate reali che sono occasionalmente glitch transitori del modello, non un limite
 * strutturale — un secondo tentativo tipicamente risolve senza mascherare un errore persistente
 * (se fallisce anche il retry, l'eccezione originale propaga invariata).
 */
export async function callStructured<T extends z.ZodTypeAny>(
  client: Anthropic,
  params: StructuredCallParams<T>,
): Promise<StructuredCallResult<z.infer<T>>> {
  let lastParseError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Awaited<ReturnType<typeof client.messages.parse>>;
    try {
      response = await client.messages.parse({
        model: params.model,
        max_tokens: params.maxTokens ?? 4096,
        system: params.system,
        messages: [{ role: "user", content: params.userContent }],
        output_config: { format: zodOutputFormat(params.schema) },
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Failed to parse structured output")) {
        lastParseError = error;
        continue;
      }
      throw error;
    }

    if (response.stop_reason === "refusal") {
      throw new Error(`Anthropic ha rifiutato la richiesta (categoria: ${response.stop_details?.category ?? "sconosciuta"})`);
    }
    if (response.stop_reason === "max_tokens" || response.parsed_output === null || response.parsed_output === undefined) {
      throw new Error("Output Anthropic incompleto o non parsabile (max_tokens raggiunto o parsing fallito)");
    }

    const data = params.schema.parse(response.parsed_output) as z.infer<T>;

    return {
      data,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        costUsd: computeCostUsd(response.model, response.usage.input_tokens, response.usage.output_tokens),
      },
      model: response.model,
    };
  }

  throw lastParseError;
}
