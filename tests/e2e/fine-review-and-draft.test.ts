import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Flusso end-to-end principale n.2 (SPEC.md §21 Fase 5): una multa arriva via PEC con termine
 * ridotto entro 48h → la pratica nasce con `isPec=true` e priorità CRITICAL per il motore di
 * regole deterministico (SPEC.md §8, non solo il modello) → un utente genera una bozza di
 * risposta e la approva esplicitamente (SPEC.md §11, invariante 3 di CLAUDE.md: mai inviata).
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
const { POST: postDraft } = await import("@/app/api/cases/[id]/drafts/route");
const { PATCH: patchDraft } = await import("@/app/api/cases/[id]/drafts/[draftId]/route");

function jsonRequest(method: string, body?: unknown) {
  return new Request("http://localhost/test", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/** dd/mm/yyyy di domani, Europe/Rome — sempre entro le 48h della regola (SPEC.md §8), mai negativo. */
function tomorrowItalianDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

describe("E2E — multa via PEC con termine ridotto → priorità CRITICAL → bozza approvata (SPEC.md §6, §7, §8, §11)", () => {
  let mailboxId: string;
  let threadId: string;
  let messageId: string;
  let caseId: string;

  beforeAll(async () => {
    const mailbox = await prisma.mailboxConnection.create({
      data: {
        provider: "PEC_IMAP",
        displayName: "E2E PEC",
        emailAddress: "e2e-pec@pec.mizeta.it",
        status: "CONNECTED",
        isPec: true,
        externalAccountId: "e2e-pec",
      },
    });
    mailboxId = mailbox.id;

    const thread = await prisma.emailThread.create({
      data: { mailboxConnectionId: mailboxId, providerThreadId: "e2e-fine-thread-001", subject: "Verbale di accertamento n. 12345/2026" },
    });
    threadId = thread.id;

    const message = await prisma.emailMessage.create({
      data: {
        mailboxConnectionId: mailboxId,
        threadId,
        providerMessageId: "E2E-FINE-001",
        internetMessageId: "<e2e-fine-001@pec.test.local>",
        direction: "INBOUND",
        fromAddress: "notifiche@pec.comune-test.it",
        toAddresses: ["e2e-pec@pec.mizeta.it"],
        ccAddresses: [],
        subject: "Verbale di accertamento n. 12345/2026",
        bodyText:
          "Verbale di accertamento n. 12345/2026 per violazione art. 142 C.d.S., elevato in data 10/07/2026. " +
          "Importo ordinario: 87,00 EUR. Importo ridotto: 43,00 EUR da pagare entro il " +
          `${tomorrowItalianDate()}.`,
        receivedAt: new Date(),
        isPec: true,
        pecMessageType: "MESSAGE",
        hasAttachments: false,
      },
    });
    messageId = message.id;
  });

  beforeEach(() => {
    cookieStore.clear();
  });

  afterAll(async () => {
    if (caseId) {
      await prisma.emailDraft.deleteMany({ where: { caseId } });
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
    await prisma.$disconnect();
  });

  it("classifica come multa PEC con priorità CRITICAL, poi crea e approva la bozza", async () => {
    // 1. Pipeline AI: classificazione, estrazione, motore di regole (SPEC.md §6, §8).
    await processIncomingMessage(messageId);
    const processedMessage = await prisma.emailMessage.findUniqueOrThrow({ where: { id: messageId } });
    expect(processedMessage.caseId).toBeTruthy();
    caseId = processedMessage.caseId!;

    const createdCase = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    expect(createdCase.category).toBe("FINE_OR_PENALTY");
    expect(createdCase.isPec).toBe(true);
    // La priorità CRITICAL viene dal motore di regole deterministico (termine ridotto entro 48h),
    // non da un'affermazione diretta del modello — SPEC.md §8.
    expect(createdCase.priority).toBe("CRITICAL");

    const reducedDeadline = await prisma.caseDeadline.findFirst({ where: { caseId, kind: "PAYMENT_REDUCED_DUE" } });
    expect(reducedDeadline).toBeTruthy();

    // 2. Un utente genera una bozza di risposta (SPEC.md §11) — mai generata/inviata automaticamente.
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    await createSession(admin.id);

    const draftResponse = await postDraft(jsonRequest("POST"), { params: Promise.resolve({ id: caseId }) });
    expect(draftResponse.status).toBe(201);
    const { draft } = await draftResponse.json();
    expect(draft.status).toBe("PENDING_APPROVAL");
    expect(draft).not.toHaveProperty("sentAt");
    // Nessun customer/supplier collegato a una multa PEC: il destinatario proposto ricade sul
    // mittente dell'ultimo messaggio in ingresso (create-draft-for-case.ts), altrimenti la bozza
    // resterebbe permanentemente senza destinatario e mai approvabile (P0 #2 sotto).
    expect(draft.toAddresses).toEqual(["notifiche@pec.comune-test.it"]);

    const draftAudit = await prisma.auditLog.findFirst({ where: { caseId, action: "DRAFT_GENERATED" } });
    expect(draftAudit).toBeTruthy();

    // 3. Approvazione umana esplicita (invariante 3 di CLAUDE.md): senza questo passaggio la bozza
    // non ha mai valore operativo, e comunque non esiste alcuna azione di invio nell'MVP.
    const approveResponse = await patchDraft(jsonRequest("PATCH", { action: "approve" }), { params: Promise.resolve({ id: caseId, draftId: draft.id }) });
    expect(approveResponse.status).toBe(200);
    const approvedBody = await approveResponse.json();
    expect(approvedBody.draft.status).toBe("APPROVED");
    expect(approvedBody.draft.approvedById).toBe(admin.id);

    const approveAudit = await prisma.auditLog.findFirst({ where: { caseId, action: "DRAFT_APPROVED" } });
    expect(approveAudit).toBeTruthy();
  });
});
