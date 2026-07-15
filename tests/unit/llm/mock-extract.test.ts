import { describe, expect, it } from "vitest";
import { extractHeuristically } from "@/lib/adapters/llm/mock/extract-heuristics";
import type { ExtractionMessageInput } from "@/lib/adapters/llm/types";

function messages(overrides: Partial<ExtractionMessageInput>): ExtractionMessageInput[] {
  return [
    {
      emailMessageId: "msg-1",
      subject: "",
      bodyText: "",
      receivedAt: new Date().toISOString(),
      attachments: [],
      ...overrides,
    },
  ];
}

describe("extractHeuristically — QUOTE_REQUEST", () => {
  it("estrae pallet, peso, sponda idraulica e ADR da EML-001 (baseline completo)", () => {
    const result = extractHeuristically(
      "QUOTE_REQUEST",
      messages({
        subject: "Richiesta preventivo trasporto Milano - Bari",
        bodyText:
          "Buongiorno,\n\nvorremmo un preventivo per un trasporto completo (FTL) da Milano a Bari.\n" +
          "Ritiro: 20/07/2026 mattina. Consegna: 22/07/2026.\n" +
          "Merce: componentistica industriale, 10 pallet, peso totale 3000 kg.\n" +
          "Serve sponda idraulica per lo scarico. Nessun ADR.\n\nGrazie, Giulia Rossi",
      }),
    );

    expect(result.pallet_count.value).toBe(10);
    expect(result.weight_kg.value).toBe(3000);
    expect(result.hydraulic_tailgate_required.value).toBe(true);
    expect(result.adr_required.value).toBe(false);
    expect(result.transport_mode.value).toBe("FTL");
  });

  it("segnala i dati mancanti su un preventivo incompleto (EML-002), mai inventati", () => {
    const result = extractHeuristically(
      "QUOTE_REQUEST",
      messages({
        subject: "Preventivo trasporto",
        bodyText: "Salve, potreste farmi un preventivo per una spedizione da Torino verso il Sud Italia? Non ho ancora le date precise né il peso esatto.",
      }),
    );
    expect(result.pallet_count.value).toBeNull();
    expect(result.weight_kg.value).toBeNull();
    expect(result.missing_data.length).toBeGreaterThan(0);
  });
});

describe("extractHeuristically — SUPPLIER_INVOICE", () => {
  it("non inventa mai una scadenza quando l'allegato dichiara 'non indicata' (EML-008)", () => {
    const result = extractHeuristically(
      "SUPPLIER_INVOICE",
      messages({
        subject: "Fattura FAT-2026-1102",
        bodyText: "Buongiorno, in allegato la fattura FAT-2026-1102 per la fornitura di pneumatici. Imponibile 850,00 EUR, IVA 187,00 EUR, totale 1.037,00 EUR.",
        attachments: [
          {
            attachmentId: "att-1",
            fileName: "FAT-2026-1102.pdf",
            isReadable: true,
            text: "FATTURA FAT-2026-1102 - Pneumatici Veloce S.p.A. - Imponibile 850.00 EUR - IVA 187.00 EUR - Totale 1037.00 EUR - Scadenza: non indicata",
          },
        ],
      }),
    );
    expect(result.due_date.value).toBeNull();
    expect(result.amount_total.value).toBeCloseTo(1037, 1);
  });

  it("possible_duplicate è sempre false lato modello: la decisione spetta al matching engine", () => {
    const result = extractHeuristically("SUPPLIER_INVOICE", messages({ subject: "Fattura FAT-2026-0001", bodyText: "In allegato la fattura." }));
    expect(result.possible_duplicate.value).toBe(false);
  });

  it("non legge mai il contenuto di un allegato non leggibile", () => {
    const result = extractHeuristically(
      "SUPPLIER_INVOICE",
      messages({
        subject: "Fattura",
        bodyText: "In allegato la fattura.",
        attachments: [{ attachmentId: "att-x", fileName: "corrotto.pdf", isReadable: false, text: null }],
      }),
    );
    // Nessun campo deve provenire da un allegato che non esiste come testo leggibile.
    expect(result.amount_total.source_attachment_id).toBeNull();
  });
});

describe("extractHeuristically — FINE_OR_PENALTY", () => {
  it("estrae importo ridotto e scadenza ridotta da un verbale con termine esplicito (EML-015)", () => {
    const result = extractHeuristically(
      "FINE_OR_PENALTY",
      messages({
        subject: "Verbale di accertamento n. MI-2026-889231",
        bodyText:
          "Si notifica il verbale di accertamento n. MI-2026-889231 per violazione art. 142 C.d.S., " +
          "elevato in data 10/07/2026 a carico del veicolo targato AB123CD, conducente Mario Bianchi. " +
          "Importo ordinario: 173,00 EUR. Importo ridotto (pagamento entro 5 giorni dalla notifica): 121,00 EUR. " +
          "Termine per il pagamento in misura ridotta: 17/07/2026. Termine per il ricorso: 60 giorni.",
      }),
    );
    expect(result.notice_number.value).toBe("MI-2026-889231");
    expect(result.plate.value).toBe("AB123CD");
    expect(result.reduced_amount.value).toBeCloseTo(121, 1);
    expect(result.reduced_payment_due_at.value).toContain("2026-07-17");
  });
});
