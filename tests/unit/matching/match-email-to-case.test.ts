import { describe, expect, it, beforeEach } from "vitest";
import { matchEmailToCase } from "@/lib/matching/match-email-to-case";
import { InMemoryCaseRepository } from "@/lib/matching/in-memory-case-repository";
import type { MatchEmailInput } from "@/lib/matching/types";

const SETTINGS = { autoLinkConfidenceThreshold: 0.85, possibleDuplicateConfidenceThreshold: 0.5 };

function baseInput(overrides: Partial<MatchEmailInput>): MatchEmailInput {
  return {
    mailboxConnectionId: "info",
    providerThreadId: "thread-x",
    internetMessageId: null,
    inReplyTo: null,
    references: [],
    isPec: false,
    pecMessageType: null,
    fromAddress: "mittente@example.com",
    subject: "",
    bodyText: "",
    receivedAt: new Date("2026-07-01T10:00:00Z"),
    category: "OTHER",
    ...overrides,
  };
}

describe("matchEmailToCase — cascata SPEC.md §7", () => {
  let repo: InMemoryCaseRepository;

  beforeEach(() => {
    repo = new InMemoryCaseRepository();
  });

  it("livello 1 — provider thread: due messaggi nello stesso thread si agganciano alla stessa pratica", async () => {
    await repo.recordCase({ caseId: "case-1", category: "QUOTE_REQUEST", title: "t", summary: null, invoiceNumbers: [], orderNumbers: [], shipmentReferences: [], fineNoticeNumbers: [] });
    await repo.recordMessage({ caseId: "case-1", emailMessageId: "m1", mailboxConnectionId: "info", providerThreadId: "thread-abc", internetMessageId: "<1@x>", subject: "s", bodyText: "b", fromAddress: "a@x.it", receivedAt: new Date(), attachments: [] });

    const result = await matchEmailToCase(baseInput({ providerThreadId: "thread-abc" }), repo, SETTINGS);
    expect(result.caseId).toBe("case-1");
    expect(result.level).toBe("provider_thread");
    expect(result.confidence).toBe(1);
  });

  it("livello 2 — message-id: In-Reply-To punta a un internetMessageId noto", async () => {
    await repo.recordCase({ caseId: "case-2", category: "TRANSPORT_ORDER", title: "t", summary: null, invoiceNumbers: [], orderNumbers: [], shipmentReferences: [], fineNoticeNumbers: [] });
    await repo.recordMessage({ caseId: "case-2", emailMessageId: "m1", mailboxConnectionId: "info", providerThreadId: "thread-other", internetMessageId: "<003@mizeta.it>", subject: "s", bodyText: "b", fromAddress: "a@x.it", receivedAt: new Date(), attachments: [] });

    const result = await matchEmailToCase(baseInput({ providerThreadId: "thread-new", inReplyTo: "<003@mizeta.it>" }), repo, SETTINGS);
    expect(result.caseId).toBe("case-2");
    expect(result.level).toBe("message_id");
  });

  it("livello 3 — numero fattura: si aggancia a una pratica non-fattura che referenzia lo stesso numero", async () => {
    await repo.recordCase({ caseId: "case-3", category: "CUSTOMER_RECEIVABLE", title: "t", summary: null, invoiceNumbers: ["FAT-2026-0001"], orderNumbers: [], shipmentReferences: [], fineNoticeNumbers: [] });

    const result = await matchEmailToCase(
      baseInput({ providerThreadId: "thread-new-2", subject: "Fattura FAT-2026-0001", bodyText: "Confermiamo pagamento fattura FAT-2026-0001.", category: "CUSTOMER_RECEIVABLE" }),
      repo,
      SETTINGS,
    );
    expect(result.caseId).toBe("case-3");
    expect(result.level).toBe("invoice_number");
  });

  it("livello 3bis — numero fattura duplicata verso una SUPPLIER_INVOICE esistente: mai auto-link, va in coda", async () => {
    await repo.recordCase({ caseId: "case-4", category: "SUPPLIER_INVOICE", title: "t", summary: null, invoiceNumbers: ["FAT-2026-2050"], orderNumbers: [], shipmentReferences: [], fineNoticeNumbers: [] });

    const result = await matchEmailToCase(
      baseInput({ providerThreadId: "thread-new-3", subject: "Fattura FAT-2026-2050 (invio)", bodyText: "Vi rinviamo la fattura FAT-2026-2050 già trasmessa.", category: "SUPPLIER_INVOICE" }),
      repo,
      SETTINGS,
    );
    expect(result.caseId).toBeNull();
    expect(result.possibleDuplicateOf?.caseId).toBe("case-4");
    expect(result.possibleDuplicateOf?.level).toBe("invoice_number");
  });

  it("livello 4 — numero ordine", async () => {
    await repo.recordCase({ caseId: "case-5", category: "TRANSPORT_ORDER", title: "t", summary: null, invoiceNumbers: [], orderNumbers: ["ORD-2026-0456"], shipmentReferences: [], fineNoticeNumbers: [] });
    const result = await matchEmailToCase(
      baseInput({ providerThreadId: "thread-new-4", subject: "CMR firmato - ORD-2026-0456", bodyText: "In allegato il CMR per l'ordine ORD-2026-0456." }),
      repo,
      SETTINGS,
    );
    expect(result.caseId).toBe("case-5");
    expect(result.level).toBe("order_number");
  });

  it("livello 5 — numero viaggio/spedizione", async () => {
    await repo.recordCase({ caseId: "case-6", category: "CLAIM_OR_DAMAGE", title: "t", summary: null, invoiceNumbers: [], orderNumbers: [], shipmentReferences: ["SPD-2026-3301"], fineNoticeNumbers: [] });
    const result = await matchEmailToCase(baseInput({ providerThreadId: "thread-new-5", bodyText: "In merito alla spedizione SPD-2026-3301." }), repo, SETTINGS);
    expect(result.caseId).toBe("case-6");
    expect(result.level).toBe("shipment_number");
  });

  it("livello 6 — numero verbale", async () => {
    await repo.recordCase({ caseId: "case-7", category: "FINE_OR_PENALTY", title: "t", summary: null, invoiceNumbers: [], orderNumbers: [], shipmentReferences: [], fineNoticeNumbers: ["MI-2026-889231"] });
    const result = await matchEmailToCase(
      baseInput({ providerThreadId: "thread-new-6", bodyText: "Il messaggio 'Verbale di accertamento n. MI-2026-889231' proveniente da..." }),
      repo,
      SETTINGS,
    );
    expect(result.caseId).toBe("case-7");
    expect(result.level).toBe("fine_number");
  });

  it("livello 7 — stesso mittente recente, stessa categoria: confidenza debole, mai sufficiente per auto-link", async () => {
    await repo.recordCase({ caseId: "case-8", category: "CUSTOMER_COMMUNICATION", title: "t", summary: null, invoiceNumbers: [], orderNumbers: [], shipmentReferences: [], fineNoticeNumbers: [] });
    await repo.recordMessage({ caseId: "case-8", emailMessageId: "m1", mailboxConnectionId: "info", providerThreadId: "thread-old", internetMessageId: "<old@x>", subject: "s", bodyText: "b", fromAddress: "mittente@example.com", receivedAt: new Date("2026-06-25T10:00:00Z"), attachments: [] });

    const result = await matchEmailToCase(baseInput({ providerThreadId: "thread-new-7", category: "CUSTOMER_COMMUNICATION", receivedAt: new Date("2026-06-28T10:00:00Z") }), repo, SETTINGS);
    expect(result.caseId).toBeNull();
    expect(result.possibleDuplicateOf?.level).toBe("recent_sender");
    expect(result.possibleDuplicateOf!.confidence).toBeLessThan(SETTINGS.autoLinkConfidenceThreshold);
  });

  it("livello 8 — similarità semantica: proxy a overlap di token, confidenza sempre limitata", async () => {
    await repo.recordCase({ caseId: "case-9", category: "OTHER", title: "Fiera della Logistica 2026 evento Bologna", summary: "Invito fiera logistica settembre", invoiceNumbers: [], orderNumbers: [], shipmentReferences: [], fineNoticeNumbers: [] });
    const result = await matchEmailToCase(
      baseInput({ providerThreadId: "thread-new-8", category: "OTHER", subject: "Fiera della Logistica 2026", bodyText: "Siete invitati alla fiera logistica evento Bologna settembre." }),
      repo,
      SETTINGS,
    );
    expect(result.possibleDuplicateOf?.level ?? result.level).toBe(result.caseId ? result.level : "semantic_similarity");
    expect(result.confidence).toBeLessThanOrEqual(0.6);
  });

  it("un livello a priorità più alta vince anche se uno più basso troverebbe anch'esso un match", async () => {
    await repo.recordCase({ caseId: "case-thread", category: "QUOTE_REQUEST", title: "t", summary: null, invoiceNumbers: ["FAT-9999"], orderNumbers: [], shipmentReferences: [], fineNoticeNumbers: [] });
    await repo.recordMessage({ caseId: "case-thread", emailMessageId: "m1", mailboxConnectionId: "info", providerThreadId: "thread-priority", internetMessageId: "<p@x>", subject: "s", bodyText: "b", fromAddress: "a@x.it", receivedAt: new Date(), attachments: [] });
    await repo.recordCase({ caseId: "case-invoice", category: "CUSTOMER_RECEIVABLE", title: "t2", summary: null, invoiceNumbers: ["FAT-9999"], orderNumbers: [], shipmentReferences: [], fineNoticeNumbers: [] });

    // Stesso provider thread di case-thread MA testo che referenzia anche la fattura di case-invoice:
    // il livello 1 (provider thread) deve vincere sul livello 3 (numero fattura).
    const result = await matchEmailToCase(baseInput({ providerThreadId: "thread-priority", bodyText: "fattura FAT-9999" }), repo, SETTINGS);
    expect(result.caseId).toBe("case-thread");
    expect(result.level).toBe("provider_thread");
  });

  it("ricevuta PEC: si collega alla pratica del messaggio originale via oggetto incorporato, mai crea una nuova pratica", async () => {
    await repo.recordCase({ caseId: "case-fine", category: "FINE_OR_PENALTY", title: "t", summary: null, invoiceNumbers: [], orderNumbers: [], shipmentReferences: [], fineNoticeNumbers: [] });
    await repo.recordMessage({
      caseId: "case-fine",
      emailMessageId: "eml-015",
      mailboxConnectionId: "pec",
      providerThreadId: "thread-015",
      internetMessageId: "<015@pec.comune.milano.it>",
      subject: "Verbale di accertamento n. MI-2026-889231",
      bodyText: "...",
      fromAddress: "poliziallocale@pec.comune.milano.it",
      receivedAt: new Date("2026-07-12T09:00:00Z"),
      attachments: [],
    });

    const result = await matchEmailToCase(
      baseInput({
        mailboxConnectionId: "pec",
        providerThreadId: "thread-016",
        isPec: true,
        pecMessageType: "DELIVERY_RECEIPT",
        subject: "AVVISO DI CONSEGNA: Verbale di accertamento n. MI-2026-889231",
        bodyText: "Il messaggio 'Verbale di accertamento n. MI-2026-889231' proveniente da poliziallocale@pec.comune.milano.it è stato consegnato.",
        receivedAt: new Date("2026-07-12T09:01:14Z"),
      }),
      repo,
      SETTINGS,
    );
    expect(result.isPecReceipt).toBe(true);
    expect(result.caseId).toBe("case-fine");
  });

  it("ricevuta PEC non risolvibile: nessuna pratica creata, ma segnalata (non persa silenziosamente)", async () => {
    const result = await matchEmailToCase(
      baseInput({ isPec: true, pecMessageType: "DELIVERY_RECEIPT", subject: "Notifica generica", bodyText: "Consegna avvenuta." }),
      repo,
      SETTINGS,
    );
    expect(result.isPecReceipt).toBe(true);
    expect(result.caseId).toBeNull();
  });
});
