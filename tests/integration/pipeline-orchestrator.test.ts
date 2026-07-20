import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { processIncomingMessage } from "@/lib/pipeline/process-incoming-message";
import { extractMessageAttachments } from "@/lib/attachments/extract-message-attachments";

/**
 * Test end-to-end dell'orchestratore (SPEC.md §6, §7, §8) contro Postgres di test. Crea le
 * proprie fixture isolate (mailbox/thread/messaggi dedicati a questo file, mai i fixture
 * condivisi di prisma/seed-data/emails.ts) e le rimuove in `afterAll`, per non alterare i
 * conteggi verificati da tests/integration/seed-integrity.test.ts.
 */
describe("processIncomingMessage — orchestratore pipeline", () => {
  let mailboxId: string;
  const createdCaseIds: string[] = [];
  const createdMessageIds: string[] = [];
  const createdThreadIds: string[] = [];

  beforeAll(async () => {
    const mailbox = await prisma.mailboxConnection.create({
      data: {
        provider: "MICROSOFT365",
        displayName: "Test Pipeline",
        emailAddress: "test-pipeline@mizeta.it",
        status: "CONNECTED",
        isPec: false,
        externalAccountId: "test-pipeline",
      },
    });
    mailboxId = mailbox.id;
  });

  afterAll(async () => {
    if (createdCaseIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { caseId: { in: createdCaseIds } } });
      await prisma.caseRelation.deleteMany({ where: { OR: [{ caseId: { in: createdCaseIds } }, { relatedCaseId: { in: createdCaseIds } }] } });
      await prisma.actionProposalRun.deleteMany({ where: { caseId: { in: createdCaseIds } } });
      await prisma.extractionRun.deleteMany({ where: { caseId: { in: createdCaseIds } } });
      await prisma.classificationRun.deleteMany({ where: { caseId: { in: createdCaseIds } } });
      await prisma.caseDeadline.deleteMany({ where: { caseId: { in: createdCaseIds } } });
      await prisma.caseField.deleteMany({ where: { caseId: { in: createdCaseIds } } });
    }
    if (createdMessageIds.length > 0) {
      await prisma.attachment.deleteMany({ where: { emailMessageId: { in: createdMessageIds } } });
      await prisma.classificationRun.deleteMany({ where: { emailMessageId: { in: createdMessageIds } } });
      await prisma.emailMessage.deleteMany({ where: { id: { in: createdMessageIds } } });
    }
    if (createdCaseIds.length > 0) {
      await prisma.case.deleteMany({ where: { id: { in: createdCaseIds } } });
    }
    if (createdThreadIds.length > 0) {
      await prisma.emailThread.deleteMany({ where: { id: { in: createdThreadIds } } });
    }
    await prisma.mailboxConnection.delete({ where: { id: mailboxId } });
    await prisma.$disconnect();
  });

  async function createMessage(params: {
    providerMessageId: string;
    providerThreadId: string;
    subject: string;
    bodyText: string;
    attachment?: { fileName: string; isReadable: boolean; text: string };
  }) {
    const thread = await prisma.emailThread.create({
      data: { mailboxConnectionId: mailboxId, providerThreadId: params.providerThreadId, subject: params.subject },
    });
    createdThreadIds.push(thread.id);

    const message = await prisma.emailMessage.create({
      data: {
        mailboxConnectionId: mailboxId,
        threadId: thread.id,
        providerMessageId: params.providerMessageId,
        internetMessageId: `<${params.providerMessageId}@test.local>`,
        direction: "INBOUND",
        fromAddress: "cliente@test-fixture.it",
        toAddresses: ["test-pipeline@mizeta.it"],
        ccAddresses: [],
        subject: params.subject,
        bodyText: params.bodyText,
        receivedAt: new Date(),
        isPec: false,
        hasAttachments: Boolean(params.attachment),
      },
    });
    createdMessageIds.push(message.id);

    if (params.attachment) {
      await prisma.attachment.create({
        data: {
          emailMessageId: message.id,
          fileName: params.attachment.fileName,
          mimeType: "application/pdf",
          sizeBytes: params.attachment.text.length,
          storageKey: `test-pipeline/${message.id}/${params.attachment.fileName}`,
          isReadable: params.attachment.isReadable,
        },
      });
      if (params.attachment.isReadable) {
        const { attachmentStorage } = await import("@/lib/storage/local-storage");
        await attachmentStorage.put(`test-pipeline/${message.id}/${params.attachment.fileName}`, params.attachment.text);
        // FASE 10: processIncomingMessage legge il testo già estratto (Attachment.extractedPages),
        // mai più i byte grezzi — l'estrazione va simulata qui esattamente come farebbe il job
        // EXTRACT_ATTACHMENTS reale prima di PROCESS_INCOMING_MESSAGE.
        await extractMessageAttachments(message.id);
      }
    }

    return message;
  }

  it("classifica, estrae, applica le regole e propone azioni per una fattura fornitore", async () => {
    const message = await createMessage({
      providerMessageId: "TEST-INV-001",
      providerThreadId: "test-thread-inv-001",
      subject: "Fattura FAT-2099-0001",
      bodyText: "In allegato la fattura FAT-2099-0001. Imponibile 100,00 EUR, IVA 22,00 EUR, totale 122,00 EUR. Scadenza 01/09/2026.",
      attachment: { fileName: "FAT-2099-0001.pdf", isReadable: true, text: "FATTURA FAT-2099-0001 - Imponibile 100.00 EUR - IVA 22.00 EUR - Totale 122.00 EUR - Scadenza 01/09/2026" },
    });

    const result = await processIncomingMessage(message.id);
    expect(result.match.caseId ?? "").toBe("");
    const updatedMessage = await prisma.emailMessage.findUniqueOrThrow({ where: { id: message.id } });
    expect(updatedMessage.caseId).toBeTruthy();
    createdCaseIds.push(updatedMessage.caseId!);

    const [classificationRuns, extractionRuns, actionProposalRuns, caseFields, auditLogs] = await Promise.all([
      prisma.classificationRun.findMany({ where: { caseId: updatedMessage.caseId! } }),
      prisma.extractionRun.findMany({ where: { caseId: updatedMessage.caseId! } }),
      prisma.actionProposalRun.findMany({ where: { caseId: updatedMessage.caseId! } }),
      prisma.caseField.findMany({ where: { caseId: updatedMessage.caseId! } }),
      prisma.auditLog.findMany({ where: { caseId: updatedMessage.caseId! } }),
    ]);

    expect(classificationRuns).toHaveLength(1);
    expect(classificationRuns[0].status).toBe("SUCCEEDED");
    expect(extractionRuns).toHaveLength(1);
    expect(actionProposalRuns).toHaveLength(1);
    expect(caseFields.find((f) => f.fieldKey === "invoice_number")?.value).toBe("FAT-2099-0001");
    expect(caseFields.find((f) => f.fieldKey === "amount_total")?.value).toBe("122");
    expect(auditLogs.some((a) => a.action === "CASE_CREATED")).toBe(true);

    const finalCase = await prisma.case.findUniqueOrThrow({ where: { id: updatedMessage.caseId! } });
    expect(finalCase.category).toBe("SUPPLIER_INVOICE");
  });

  it("è idempotente: rielaborare lo stesso messaggio non duplica i CaseField", async () => {
    const message = await createMessage({
      providerMessageId: "TEST-INV-002",
      providerThreadId: "test-thread-inv-002",
      subject: "Fattura FAT-2099-0099",
      bodyText: "In allegato la fattura FAT-2099-0099. Imponibile 50,00 EUR, IVA 11,00 EUR, totale 61,00 EUR. Scadenza 15/09/2026.",
    });

    const firstResult = await processIncomingMessage(message.id);
    const afterFirst = await prisma.emailMessage.findUniqueOrThrow({ where: { id: message.id } });
    createdCaseIds.push(afterFirst.caseId!);
    const fieldsAfterFirst = await prisma.caseField.count({ where: { caseId: afterFirst.caseId! } });

    await processIncomingMessage(message.id);
    const fieldsAfterSecond = await prisma.caseField.count({ where: { caseId: afterFirst.caseId! } });

    expect(fieldsAfterSecond).toBe(fieldsAfterFirst);
    expect(firstResult.match.level).toBe("none");
  });

  it("fattura duplicata: crea due pratiche distinte e le mette in coda possibili duplicati, mai un merge automatico", async () => {
    const first = await createMessage({
      providerMessageId: "TEST-DUP-001",
      providerThreadId: "test-thread-dup-001",
      subject: "Fattura FAT-2099-4321",
      bodyText: "In allegato la fattura FAT-2099-4321. Imponibile 200,00 EUR, IVA 44,00 EUR, totale 244,00 EUR. Scadenza 20/09/2026.",
    });
    const firstProcessed = await processIncomingMessage(first.id);
    const firstCaseId = (await prisma.emailMessage.findUniqueOrThrow({ where: { id: first.id } })).caseId!;
    createdCaseIds.push(firstCaseId);
    expect(firstProcessed.match.caseId).toBeNull();

    const second = await createMessage({
      providerMessageId: "TEST-DUP-002",
      providerThreadId: "test-thread-dup-002",
      subject: "Fattura FAT-2099-4321 (invio)",
      bodyText: "Vi rinviamo la fattura FAT-2099-4321 già trasmessa. Imponibile 200,00 EUR, IVA 44,00 EUR, totale 244,00 EUR.",
    });
    await processIncomingMessage(second.id);
    const secondCaseId = (await prisma.emailMessage.findUniqueOrThrow({ where: { id: second.id } })).caseId!;
    createdCaseIds.push(secondCaseId);

    expect(secondCaseId).not.toBe(firstCaseId);

    const relation = await prisma.caseRelation.findFirst({ where: { caseId: secondCaseId, relatedCaseId: firstCaseId, kind: "DUPLICATE_CANDIDATE" } });
    expect(relation).toBeTruthy();
    expect(relation?.status).toBe("PENDING");

    const secondCase = await prisma.case.findUniqueOrThrow({ where: { id: secondCaseId } });
    expect(secondCase.needsHumanReview).toBe(true);
  });

  it("allegato illeggibile: la pratica va in revisione, nessun dato viene inventato da quell'allegato", async () => {
    const message = await createMessage({
      providerMessageId: "TEST-UNREADABLE-001",
      providerThreadId: "test-thread-unreadable-001",
      subject: "Reclamo merce mancante",
      bodyText: "Segnaliamo merce mancante nella consegna. In allegato il verbale di conteggio colli, il file sembra corrotto.",
      attachment: { fileName: "verbale-conteggio.pdf", isReadable: false, text: "" },
    });

    await processIncomingMessage(message.id);
    const updated = await prisma.emailMessage.findUniqueOrThrow({ where: { id: message.id } });
    createdCaseIds.push(updated.caseId!);

    const finalCase = await prisma.case.findUniqueOrThrow({ where: { id: updated.caseId! } });
    expect(finalCase.needsHumanReview).toBe(true);

    const fields = await prisma.caseField.findMany({ where: { caseId: updated.caseId!, sourceAttachmentId: { not: null } } });
    expect(fields).toHaveLength(0);
  });
});
