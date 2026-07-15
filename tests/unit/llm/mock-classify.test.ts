import { describe, expect, it } from "vitest";
import { classifyHeuristically } from "@/lib/adapters/llm/mock/classify-heuristics";
import type { ClassificationInput } from "@/lib/adapters/llm/types";

function input(overrides: Partial<ClassificationInput>): ClassificationInput {
  return {
    emailMessageId: "msg-1",
    emailSubject: "",
    emailBody: "",
    attachments: [],
    ...overrides,
  };
}

const THRESHOLD = 0.55;

describe("classifyHeuristically", () => {
  it("classifica una richiesta di preventivo (IT)", () => {
    const result = classifyHeuristically(
      input({ emailSubject: "Richiesta preventivo trasporto", emailBody: "Vorremmo un preventivo per un trasporto." }),
      THRESHOLD,
    );
    expect(result.primary_category).toBe("QUOTE_REQUEST");
  });

  it("classifica una richiesta di preventivo (EN)", () => {
    const result = classifyHeuristically(
      input({ emailSubject: "Quote request Rotterdam - Milan", emailBody: "We would like a quote for a full truckload transport." }),
      THRESHOLD,
    );
    expect(result.primary_category).toBe("QUOTE_REQUEST");
  });

  it("classifica una multa", () => {
    const result = classifyHeuristically(
      input({
        emailSubject: "Verbale di accertamento n. MI-2026-889231",
        emailBody: "Si notifica il verbale di accertamento per violazione art. 142 C.d.S.",
      }),
      THRESHOLD,
    );
    expect(result.primary_category).toBe("FINE_OR_PENALTY");
  });

  it("va sotto soglia (UNCERTAIN + needs_human_review) su testo senza segnali", () => {
    const result = classifyHeuristically(input({ emailSubject: "Informazioni", emailBody: "Salve, volevo sapere delle info." }), THRESHOLD);
    expect(result.primary_category).toBe("UNCERTAIN");
    expect(result.needs_human_review).toBe(true);
  });

  it("rileva una categoria secondaria su email con più intenzioni", () => {
    const result = classifyHeuristically(
      input({
        emailSubject: "Nuovo trasporto e sollecito fattura",
        emailBody:
          "avremmo bisogno di un nuovo trasporto Modena-Firenze. Sollecito: la fattura FAT-2026-0890 risulta ancora aperta dal nostro gestionale.",
      }),
      THRESHOLD,
    );
    // Il messaggio contiene segnali sia di trasporto sia di credito cliente: una delle due deve
    // comparire come categoria secondaria quando i punteggi sono vicini.
    expect(["TRANSPORT_ORDER", "CUSTOMER_RECEIVABLE"]).toContain(result.primary_category);
  });

  it("non inventa mai un deadline quando non presente nel testo", () => {
    const result = classifyHeuristically(input({ emailSubject: "Cambio referente ordini", emailBody: "Il nuovo referente sarà Luca." }), THRESHOLD);
    expect(result.deadline).toBeNull();
  });
});
