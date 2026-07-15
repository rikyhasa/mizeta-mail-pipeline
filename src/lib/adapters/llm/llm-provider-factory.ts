import { env } from "@/lib/config/env";
import type { LLMProvider } from "@/lib/adapters/llm/types";
import { mockLLMProvider } from "@/lib/adapters/llm/mock-llm-provider";
import { AnthropicLLMProvider } from "@/lib/adapters/llm/anthropic-llm-provider";
// OpenAILLMProvider non è costruito qui: LLM_PROVIDER=openai fallisce esplicitamente sotto,
// senza istanziare lo scheletro non funzionante (src/lib/adapters/llm/openai-llm-provider.ts).

/**
 * Factory basata su `env.LLM_PROVIDER`. Fallisce sempre in modo esplicito e comprensibile, mai
 * silenziosamente: `openai` non è implementato in questa fase, `anthropic` richiede una API key.
 */
export function getLLMProvider(): LLMProvider {
  switch (env.LLM_PROVIDER) {
    case "mock":
      return mockLLMProvider;
    case "anthropic": {
      if (!env.ANTHROPIC_API_KEY) {
        throw new Error("LLM_PROVIDER=anthropic ma ANTHROPIC_API_KEY non è impostata nell'ambiente.");
      }
      return new AnthropicLLMProvider({ apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL });
    }
    case "openai":
      throw new Error(
        "LLM_PROVIDER=openai: provider non implementato in questa fase (solo interfaccia/scheletro). Usa 'anthropic' o 'mock'.",
      );
    default: {
      const exhaustiveCheck: never = env.LLM_PROVIDER;
      throw new Error(`LLM_PROVIDER non riconosciuto: ${String(exhaustiveCheck)}`);
    }
  }
}

/** Istanza pigra e memorizzata, per riuso nell'orchestratore senza ricostruire il client a ogni chiamata. */
let cachedProvider: LLMProvider | null = null;

export function getCachedLLMProvider(): LLMProvider {
  if (!cachedProvider) cachedProvider = getLLMProvider();
  return cachedProvider;
}

/** Usata dai test per forzare la ricostruzione del provider dopo un cambio env. */
export function resetCachedLLMProvider(): void {
  cachedProvider = null;
}
