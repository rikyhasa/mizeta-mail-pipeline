import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Flusso end-to-end principale n.1 (SPEC.md §21 Fase 5: "test end-to-end dei flussi
 * principali in mock"): un'email di richiesta preventivo arriva → viene classificata ed
 * estratta dalla pipeline (mock, nessuna API key) → la pratica compare nella query usata dalla
 * dashboard → un utente conferma un campo estratto → genera la scheda preventivo in PDF.
 * Attraversa le stesse funzioni/route usate in produzione (nessun mock aggiuntivo oltre
 * LLM_PROVIDER=mock, già la modalità di default dei test), non solo un singolo endpoint.
 */

const cookieStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieStore.has(name) ? { name, value: cookieStore.get(name)! } : undefined),
    set: (name: string, value: string) => {
      cookieStore.set(name, value);
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
    has: (name: string) => cookieStore.has(name),
  }),
}));

const { prisma } = await import("@/lib/db/prisma");
const { createSession } = await import("@/lib/auth/session");
const { processIncomingMessage } = await import("@/lib/pipeline/process-incoming-message");
const { getFilteredCases } = await import("@/lib/dashboard/queries");
const { PATCH: patchField } = await import("@/app/api/cases/[id]/fields/[fieldKey]/route");
const { POST: postDocument } = await import("@/app/api/cases/[id]/documents/route");
const { closeSharedBrowser } = await import("@/lib/adapters/documents/puppeteer-document-service");

function jsonRequest(method: string, body?: unknown) {
  return new Request("http://localhost/test", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("E2E — richiesta preventivo → pratica → conferma campo → documento (SPEC.md §6, §9, §10, §12)", () => {
  let mailboxId: string;
  let threadId: string;
  let messageId: string;
  let caseId: string;
  const documentIds: string[] = [];

  beforeAll(async () => {
    const mailbox = await prisma.mailboxConnection.create({
      data: {
        provider: "MICROSOFT365",
        displayName: "E2E Preventivi",
        emailAddress: "e2e-quotes@mizeta.it",
        status: "CONNECTED",
        isPec: false,
        externalAccountId: "e2e-quotes",
      },
    });
    mailboxId = mailbox.id;

    const thread = await prisma.emailThread.create({
      data: { mailboxConnectionId: mailboxId, providerThreadId: "e2e-quote-thread-001", subject: "Richiesta preventivo Milano-Roma" },
    });
    threadId = thread.id;

    const message = await prisma.emailMessage.create({
      data: {
        mailboxConnectionId: mailboxId,
        threadId,
        providerMessageId: "E2E-QUOTE-001",
        internetMessageId: "<e2e-quote-001@test.local>",
        direction: "INBOUND",
        fromAddress: "cliente@e2e-fixture.it",
        toAddresses: ["e2e-quotes@mizeta.it"],
        ccAddresses: [],
        subject: "Richiesta preventivo trasporto Milano-Roma",
        bodyText:
          "Buongiorno, vorremmo un preventivo per un trasporto in groupage da Milano a Roma. " +
          "Quantità: 10 pallet, peso 500 kg. Ritiro previsto il 20/07/2026, consegna il 22/07/2026. " +
          "Vi chiediamo di rispondere entro il 17/07/2026. Restiamo in attesa di un vostro riscontro.",
        receivedAt: new Date(),
        isPec: false,
        hasAttachments: false,
      },
    });
    messageId = message.id;
  });

  beforeEach(() => {
    cookieStore.clear();
  });

  afterAll(async () => {
    if (documentIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { entityType: "GeneratedDocument", entityId: { in: documentIds } } });
      await prisma.generatedDocument.deleteMany({ where: { id: { in: documentIds } } });
    }
    if (caseId) {
      await prisma.auditLog.deleteMany({ where: { caseId } });
      await prisma.actionProposalRun.deleteMany({ where: { caseId } });
      await prisma.extractionRun.deleteMany({ where: { caseId } });
      await prisma.classificationRun.deleteMany({ where: { caseId } });
      await prisma.caseDeadline.deleteMany({ where: { caseId } });
      await prisma.caseField.deleteMany({ where: { caseId } });
    }
    await prisma.classificationRun.deleteMany({ where: { emailMessageId: messageId } });
    await prisma.emailMessage.deleteMany({ where: { id: messageId } });
    if (caseId) await prisma.case.deleteMany({ where: { id: caseId } });
    await prisma.emailThread.deleteMany({ where: { id: threadId } });
    await prisma.mailboxConnection.delete({ where: { id: mailboxId } });
    await closeSharedBrowser();
    await prisma.$disconnect();
  });

  it(
    "attraversa l'intero flusso: pipeline AI → dashboard → conferma campo → generazione PDF",
    async () => {
      // 1. La pipeline AI (mock) classifica ed estrae, crea la pratica (SPEC.md §6).
      const result = await processIncomingMessage(messageId);
      const processedMessage = await prisma.emailMessage.findUniqueOrThrow({ where: { id: messageId } });
      expect(processedMessage.caseId).toBeTruthy();
      caseId = processedMessage.caseId!;

      const createdCase = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
      expect(createdCase.category).toBe("QUOTE_REQUEST");
      expect(result.match.level).toBe("none"); // nessuna pratica preesistente da associare: ne è stata creata una nuova

      const palletField = await prisma.caseField.findFirst({ where: { caseId, fieldKey: "pallet_count" } });
      expect(palletField?.value).toBe("10");
      expect(palletField?.sourceType).toBe("EMAIL_BODY");

      const createdAudit = await prisma.auditLog.findFirst({ where: { caseId, action: "CASE_CREATED" } });
      expect(createdAudit).toBeTruthy();

      // 2. La pratica è visibile nella query usata dalla dashboard (SPEC.md §9), non solo nel DB.
      const { items } = await getFilteredCases({ category: "QUOTE_REQUEST" });
      expect(items.some((i) => i.id === caseId)).toBe(true);

      // 3. Un utente autenticato conferma il campo estratto (SPEC.md §10) via la stessa route API della UI.
      const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
      await createSession(admin.id);

      const confirmResponse = await patchField(jsonRequest("PATCH", {}), { params: Promise.resolve({ id: caseId, fieldKey: "pallet_count" }) });
      expect(confirmResponse.status).toBe(200);
      const confirmBody = await confirmResponse.json();
      expect(confirmBody.field.needsHumanReview).toBe(false);
      expect(confirmBody.field.confirmedById).toBe(admin.id);

      const confirmAudit = await prisma.auditLog.findFirst({ where: { caseId, action: "FIELD_CONFIRMED", entityId: palletField!.id } });
      expect(confirmAudit).toBeTruthy();

      // 4. Genera la scheda preventivo in PDF (SPEC.md §12) — documento richiesto dalla Definition of Done.
      const documentResponse = await postDocument(jsonRequest("POST", { type: "QUOTE_SHEET", format: "PDF" }), { params: Promise.resolve({ id: caseId }) });
      expect(documentResponse.status).toBe(201);
      const { document } = await documentResponse.json();
      documentIds.push(document.id);

      const { attachmentStorage } = await import("@/lib/storage/local-storage");
      const bytes = await attachmentStorage.get(document.storageKey);
      expect(bytes.subarray(0, 4).toString("latin1")).toBe("%PDF");

      const documentAudit = await prisma.auditLog.findFirst({ where: { caseId, action: "DOCUMENT_GENERATED", entityId: document.id } });
      expect(documentAudit).toBeTruthy();
    },
    30_000,
  );
});
