import { describe, expect, it } from "vitest";
import { detectPecMessageType, parsePostacertEnvelope } from "@/lib/adapters/mail/pec-imap/postacert";

describe("detectPecMessageType — convenzioni reali Aruba/Legalmail", () => {
  it("riconosce un messaggio vero da 'POSTA CERTIFICATA:'", () => {
    expect(detectPecMessageType("POSTA CERTIFICATA: Richiesta preventivo trasporto")).toBe("MESSAGE");
  });

  it("riconosce una ricevuta di accettazione", () => {
    expect(detectPecMessageType("ACCETTAZIONE: Multa verbale 12345")).toBe("ACCEPTANCE_RECEIPT");
  });

  it("riconosce una ricevuta di avvenuta consegna", () => {
    expect(detectPecMessageType("AVVENUTA CONSEGNA: Multa verbale 12345")).toBe("DELIVERY_RECEIPT");
  });

  it("riconosce una ricevuta di mancata consegna", () => {
    expect(detectPecMessageType("MANCATA CONSEGNA: Multa verbale 12345")).toBe("NON_DELIVERY_RECEIPT");
  });

  it("è case-insensitive e tollera spazi iniziali", () => {
    expect(detectPecMessageType("  accettazione: qualcosa")).toBe("ACCEPTANCE_RECEIPT");
  });

  it("ricade su MESSAGE per un oggetto senza prefisso riconosciuto", () => {
    expect(detectPecMessageType("Oggetto qualunque senza prefisso")).toBe("MESSAGE");
  });
});

describe("parsePostacertEnvelope", () => {
  it("non è implementata in questa fase: lancia sempre un errore esplicito", () => {
    expect(() => parsePostacertEnvelope(Buffer.from(""))).toThrow(/non implementato/);
  });
});
