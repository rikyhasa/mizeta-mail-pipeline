import { describe, expect, it } from "vitest";
import { mapGraphAttachmentToRaw, mapGraphMessageToRaw } from "@/lib/adapters/mail/microsoft365/mappers";

describe("mapGraphMessageToRaw", () => {
  it("mappa un messaggio in entrata deducendo direction dal mittente", () => {
    const raw = mapGraphMessageToRaw(
      {
        id: "msg-1",
        conversationId: "conv-1",
        internetMessageId: "<msg-1@contoso.com>",
        internetMessageHeaders: [
          { name: "In-Reply-To", value: "<prev@contoso.com>" },
          { name: "References", value: "<a@contoso.com> <b@contoso.com>" },
        ],
        from: { emailAddress: { name: "Cliente", address: "cliente@esempio.it" } },
        toRecipients: [{ emailAddress: { address: "info@mizeta.it" } }],
        ccRecipients: [],
        subject: "Richiesta preventivo",
        body: { contentType: "text", content: "Corpo del messaggio" },
        receivedDateTime: "2026-01-15T10:00:00Z",
        hasAttachments: false,
      },
      "info@mizeta.it",
    );

    expect(raw.providerMessageId).toBe("msg-1");
    expect(raw.providerThreadId).toBe("conv-1");
    expect(raw.direction).toBe("INBOUND");
    expect(raw.inReplyTo).toBe("<prev@contoso.com>");
    expect(raw.references).toEqual(["<a@contoso.com>", "<b@contoso.com>"]);
    expect(raw.bodyText).toBe("Corpo del messaggio");
    expect(raw.isPec).toBe(false);
  });

  it("mappa un messaggio in uscita quando il mittente è la mailbox stessa", () => {
    const raw = mapGraphMessageToRaw(
      {
        id: "msg-2",
        from: { emailAddress: { address: "INFO@mizeta.it" } },
        toRecipients: [],
        ccRecipients: [],
        subject: "Risposta",
        body: { contentType: "text", content: "" },
      },
      "info@mizeta.it",
    );
    expect(raw.direction).toBe("OUTBOUND");
  });

  it("usa l'id del messaggio come providerThreadId quando conversationId è assente", () => {
    const raw = mapGraphMessageToRaw({ id: "msg-3", from: {}, toRecipients: [], ccRecipients: [], subject: "" }, "info@mizeta.it");
    expect(raw.providerThreadId).toBe("msg-3");
  });
});

describe("mapGraphAttachmentToRaw", () => {
  it("decodifica un fileAttachment leggibile da base64", () => {
    const content = Buffer.from("contenuto di test").toString("base64");
    const raw = mapGraphAttachmentToRaw({ id: "att-1", name: "documento.pdf", contentType: "application/pdf", size: 42, contentBytes: content });
    expect(raw.isReadable).toBe(true);
    expect((raw.content as Buffer).toString()).toBe("contenuto di test");
  });

  it("segna come non leggibile un allegato non-file (itemAttachment)", () => {
    const raw = mapGraphAttachmentToRaw({ id: "att-2", name: "evento.ics", "@odata.type": "#microsoft.graph.itemAttachment" });
    expect(raw.isReadable).toBe(false);
    expect(raw.content).toBe("");
  });

  it("segna come non leggibile un fileAttachment senza contentBytes", () => {
    const raw = mapGraphAttachmentToRaw({ id: "att-3", name: "vuoto.pdf" });
    expect(raw.isReadable).toBe(false);
  });
});
