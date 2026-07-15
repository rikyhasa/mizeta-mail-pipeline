import { describe, expect, it } from "vitest";
import { deduceDeadlines, resolveFieldDueAt } from "@/lib/pipeline/process-incoming-message";
import { DEFAULT_RULE_SETTINGS } from "@/lib/rules/default-settings";
import type { ExtractionOutcome } from "@/lib/pipeline/types";

/** Data civile Europe/Rome di un istante, per verificare `dueAt` indipendentemente dall'offset
 * CET/CEST usato per rappresentarlo internamente in UTC. */
function romeDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(date);
}

function field(value: string | null, sourceMessageId: string | null = null) {
  return {
    value,
    normalized_value: null,
    confidence: 0.9,
    source_type: "EMAIL_BODY",
    source_message_id: sourceMessageId,
    source_attachment_id: null,
    source_page: null,
    source_excerpt: value,
    needs_human_review: false,
  };
}

function extractionOutcome(data: Record<string, unknown>): ExtractionOutcome {
  return {
    category: "FINE_OR_PENALTY",
    result: { data, usage: { inputTokens: null, outputTokens: null, costUsd: null }, model: "test" },
  } as unknown as ExtractionOutcome;
}

// "Ora" della pipeline deliberatamente lontana dal messaggio, per far emergere un eventuale
// bug che risolva le espressioni relative rispetto a "now" invece che al messaggio sorgente.
const PIPELINE_NOW = new Date("2026-08-01T00:00:00Z");
const MESSAGE_RECEIVED_AT = "2026-07-09T09:00:00+02:00"; // giovedì

describe("deduceDeadlines", () => {
  it("risolve una data relativa rispetto al messaggio sorgente del campo, non a 'now' della pipeline", () => {
    const extraction = extractionOutcome({
      reduced_payment_due_at: field("entro 5 giorni", "msg-source"),
    });
    const messagesById = new Map([["msg-source", { receivedAt: MESSAGE_RECEIVED_AT }]]);

    const deadlines = deduceDeadlines("FINE_OR_PENALTY", extraction, null, PIPELINE_NOW, DEFAULT_RULE_SETTINGS, messagesById);

    expect(deadlines).toHaveLength(1);
    expect(deadlines[0].kind).toBe("PAYMENT_REDUCED_DUE");
    expect(romeDate(deadlines[0].dueAt)).toBe("2026-07-14");
  });

  it("ricade su 'now' della pipeline quando il source_message_id non è risolvibile", () => {
    const extraction = extractionOutcome({
      reduced_payment_due_at: field("entro 5 giorni", "msg-sconosciuto"),
    });
    const messagesById = new Map<string, { receivedAt: string }>();
    const now = new Date("2026-07-09T09:00:00+02:00");

    const deadlines = deduceDeadlines("FINE_OR_PENALTY", extraction, null, now, DEFAULT_RULE_SETTINGS, messagesById);

    expect(deadlines).toHaveLength(1);
    expect(romeDate(deadlines[0].dueAt)).toBe("2026-07-14");
  });

  it("non inventa mai una scadenza quando il valore non è normalizzabile", () => {
    const extraction = extractionOutcome({
      reduced_payment_due_at: field("quanto prima", "msg-source"),
    });
    const messagesById = new Map([["msg-source", { receivedAt: MESSAGE_RECEIVED_AT }]]);

    const deadlines = deduceDeadlines("FINE_OR_PENALTY", extraction, null, PIPELINE_NOW, DEFAULT_RULE_SETTINGS, messagesById);

    expect(deadlines).toHaveLength(0);
  });

  it("QUOTE_REQUEST usa lo stesso resolveFieldDueAt condiviso col blocco quoteResponseDueAt (parità, stesso bug corretto in entrambi i punti)", () => {
    const extraction = extractionOutcome({
      response_due_at: field("domani", "msg-source"),
    });
    const messagesById = new Map([["msg-source", { receivedAt: MESSAGE_RECEIVED_AT }]]);

    const deadlines = deduceDeadlines("QUOTE_REQUEST", extraction, null, PIPELINE_NOW, DEFAULT_RULE_SETTINGS, messagesById);
    const direct = resolveFieldDueAt("domani", "msg-source", messagesById, PIPELINE_NOW);

    expect(deadlines).toHaveLength(1);
    expect(deadlines[0].kind).toBe("RESPONSE_DUE");
    expect(deadlines[0].dueAt.getTime()).toBe(direct?.getTime());
    expect(romeDate(deadlines[0].dueAt)).toBe("2026-07-10");
  });

  it("usa la scadenza di classificazione come fallback quando nessun campo estratto produce una data", () => {
    const messagesById = new Map<string, { receivedAt: string }>();
    const deadlines = deduceDeadlines("OTHER", null, "17/07/2026", PIPELINE_NOW, DEFAULT_RULE_SETTINGS, messagesById);

    expect(deadlines).toHaveLength(1);
    expect(deadlines[0].kind).toBe("OTHER");
    expect(romeDate(deadlines[0].dueAt)).toBe("2026-07-17");
  });
});
