import { describe, expect, it } from "vitest";
import { mockLLMProvider } from "@/lib/adapters/llm/mock-llm-provider";
import { classificationResultSchema } from "@/lib/adapters/llm/schemas";

describe("MockLLMProvider", () => {
  it("returns a Zod-valid, low-confidence UNCERTAIN classification for ambiguous input", async () => {
    const result = await mockLLMProvider.classify({
      emailMessageId: "test-msg",
      emailSubject: "qualsiasi oggetto senza segnali",
      emailBody: "qualsiasi corpo generico senza parole chiave riconoscibili",
      attachments: [],
    });
    expect(() => classificationResultSchema.parse(result.data)).not.toThrow();
    expect(result.data.primary_category).toBe("UNCERTAIN");
    expect(result.data.needs_human_review).toBe(true);
    expect(result.usage).toEqual({ inputTokens: null, outputTokens: null, costUsd: null });
  });

  it("classifies a real quote request via keyword heuristics (not canned per-ID answers)", async () => {
    const result = await mockLLMProvider.classify({
      emailMessageId: "test-msg-2",
      emailSubject: "Richiesta preventivo trasporto",
      emailBody: "Buongiorno, vorremmo un preventivo per un trasporto completo FTL da Milano a Bari.",
      attachments: [],
    });
    expect(result.data.primary_category).toBe("QUOTE_REQUEST");
    expect(result.data.needs_human_review).toBe(false);
  });

  it("reports healthy", async () => {
    await expect(mockLLMProvider.healthCheck()).resolves.toEqual({ ok: true, provider: "mock" });
  });
});
