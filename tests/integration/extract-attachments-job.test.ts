import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { attachmentStorage } from "@/lib/storage/local-storage";
import { enqueueJob } from "@/lib/jobs/queue";
import { runWorkerOnce } from "@/lib/jobs/worker";
import { extractAttachmentsIdempotencyKey, processIncomingMessageIdempotencyKey } from "@/lib/jobs/types";
import { retryDeferredAttachmentExtractions } from "@/lib/attachments/extract-message-attachments";
import { getRuleSettings, invalidateRuleSettingsCache, updateRuleSettings } from "@/lib/rules/settings-repository";

/**
 * Job `EXTRACT_ATTACHMENTS`/`RETRY_DEFERRED_ATTACHMENT_EXTRACTIONS` (FASE 10,
 * docs/FASE-10-LETTURA-ALLEGATI.md) contro Postgres reale — stesso pattern di
 * tests/integration/job-queue.test.ts (drainQueue prima di ogni test, cleanup list). Ogni test
 * lascia girare anche PROCESS_INCOMING_MESSAGE fino in fondo (mai solo EXTRACT_ATTACHMENTS in
 * isolamento): è l'unico modo per verificare davvero la catena end-to-end, quindi il cleanup
 * copre anche pratica/campi/run creati dalla pipeline completa.
 */
describe("Job di estrazione allegati", () => {
  let mailboxId: string;
  let adminUserId: string;
  const createdThreadIds: string[] = [];
  const createdMessageIds: string[] = [];
  const createdCaseIds: string[] = [];
  const createdJobIds: string[] = [];

  afterAll(async () => {
    await prisma.jobAttempt.deleteMany({ where: { jobId: { in: createdJobIds } } });
    await prisma.job.deleteMany({ where: { id: { in: createdJobIds } } });
    if (createdCaseIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { caseId: { in: createdCaseIds } } });
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
    if (createdCaseIds.length > 0) await prisma.case.deleteMany({ where: { id: { in: createdCaseIds } } });
    if (createdThreadIds.length > 0) await prisma.emailThread.deleteMany({ where: { id: { in: createdThreadIds } } });
    if (mailboxId) await prisma.mailboxConnection.deleteMany({ where: { id: mailboxId } });
    await prisma.$disconnect();
  });

  afterEach(() => {
    invalidateRuleSettingsCache();
  });

  async function drainQueue(maxIterations = 100): Promise<void> {
    for (let i = 0; i < maxIterations; i += 1) {
      const { claimed } = await runWorkerOnce();
      if (!claimed) return;
    }
  }

  async function ensureMailbox(): Promise<void> {
    if (mailboxId) return;
    const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (!admin) throw new Error("nessun utente ADMIN nel seed di test");
    adminUserId = admin.id;
    const mailbox = await prisma.mailboxConnection.create({
      data: {
        provider: "MICROSOFT365",
        displayName: "Test Extract Attachments",
        emailAddress: "test-extract-attachments@mizeta.it",
        status: "CONNECTED",
        isPec: false,
        externalAccountId: "test-extract-attachments",
      },
    });
    mailboxId = mailbox.id;
  }

  async function createMessageWithAttachment(params: {
    providerMessageId: string;
    fileName: string;
    mimeType: string;
    content: Buffer | string;
  }): Promise<{ messageId: string; attachmentId: string }> {
    await ensureMailbox();

    const thread = await prisma.emailThread.create({
      data: { mailboxConnectionId: mailboxId, providerThreadId: `thread-${params.providerMessageId}`, subject: "Test" },
    });
    createdThreadIds.push(thread.id);

    const message = await prisma.emailMessage.create({
      data: {
        mailboxConnectionId: mailboxId,
        threadId: thread.id,
        providerMessageId: params.providerMessageId,
        direction: "INBOUND",
        fromAddress: "cliente@test-fixture.it",
        toAddresses: ["test-extract-attachments@mizeta.it"],
        ccAddresses: [],
        subject: "Fattura",
        bodyText: "In allegato la fattura.",
        receivedAt: new Date(),
        isPec: false,
        hasAttachments: true,
      },
    });
    createdMessageIds.push(message.id);

    const content = Buffer.isBuffer(params.content) ? params.content : Buffer.from(params.content, "utf-8");
    const storageKey = `test-extract-attachments/${message.id}/${params.fileName}`;
    await attachmentStorage.put(storageKey, content);
    const attachment = await prisma.attachment.create({
      data: { emailMessageId: message.id, fileName: params.fileName, mimeType: params.mimeType, sizeBytes: content.length, storageKey },
    });

    return { messageId: message.id, attachmentId: attachment.id };
  }

  async function trackCaseFor(messageId: string): Promise<void> {
    const message = await prisma.emailMessage.findUniqueOrThrow({ where: { id: messageId } });
    if (message.caseId && !createdCaseIds.includes(message.caseId)) createdCaseIds.push(message.caseId);
  }

  it("EXTRACT_ATTACHMENTS estrae il testo, poi accoda ed esegue PROCESS_INCOMING_MESSAGE al termine", async () => {
    await drainQueue();
    const { messageId, attachmentId } = await createMessageWithAttachment({
      providerMessageId: "EXTRACT-JOB-001",
      fileName: "fattura.pdf",
      mimeType: "application/pdf",
      content: "FATTURA FAT-TEST-001 - Totale 100.00 EUR",
    });

    const { jobId } = await enqueueJob({
      type: "EXTRACT_ATTACHMENTS",
      payload: { emailMessageId: messageId },
      idempotencyKey: extractAttachmentsIdempotencyKey(messageId),
    });
    createdJobIds.push(jobId);

    const { claimed, jobId: claimedJobId } = await runWorkerOnce();
    expect(claimed).toBe(true);
    expect(claimedJobId).toBe(jobId);

    const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.status).toBe("SUCCEEDED");

    const attachment = await prisma.attachment.findUniqueOrThrow({ where: { id: attachmentId } });
    expect(attachment.isReadable).toBe(true);
    expect(attachment.extractionStatus).toBe("SUCCEEDED");
    expect(attachment.extractionMethod).toBe("LOCAL_TEXT");
    expect(attachment.contentHash).toBeTruthy();

    const chainedJob = await prisma.job.findUniqueOrThrow({ where: { idempotencyKey: processIncomingMessageIdempotencyKey(messageId) } });
    createdJobIds.push(chainedJob.id);
    expect(chainedJob.status).toBe("PENDING");

    await drainQueue();
    const finishedChainedJob = await prisma.job.findUniqueOrThrow({ where: { id: chainedJob.id } });
    expect(finishedChainedJob.status).toBe("SUCCEEDED");
    await trackCaseFor(messageId);
  });

  it("cache per contentHash: un secondo allegato con byte identici riusa l'estrazione, senza rieseguirla", async () => {
    await drainQueue();
    const sameContent = "FATTURA FAT-TEST-DUP - Totale 500.00 EUR";
    const first = await createMessageWithAttachment({ providerMessageId: "EXTRACT-JOB-DUP-1", fileName: "dup.pdf", mimeType: "application/pdf", content: sameContent });
    const second = await createMessageWithAttachment({ providerMessageId: "EXTRACT-JOB-DUP-2", fileName: "dup.pdf", mimeType: "application/pdf", content: sameContent });

    const firstEnqueue = await enqueueJob({
      type: "EXTRACT_ATTACHMENTS",
      payload: { emailMessageId: first.messageId },
      idempotencyKey: extractAttachmentsIdempotencyKey(first.messageId),
    });
    createdJobIds.push(firstEnqueue.jobId);
    await drainQueue();

    const secondEnqueue = await enqueueJob({
      type: "EXTRACT_ATTACHMENTS",
      payload: { emailMessageId: second.messageId },
      idempotencyKey: extractAttachmentsIdempotencyKey(second.messageId),
    });
    createdJobIds.push(secondEnqueue.jobId);
    await drainQueue();

    const [firstAttachment, secondAttachment] = await Promise.all([
      prisma.attachment.findFirst({ where: { emailMessageId: first.messageId } }),
      prisma.attachment.findFirst({ where: { emailMessageId: second.messageId } }),
    ]);
    expect(firstAttachment?.contentHash).toBe(secondAttachment?.contentHash);
    expect(secondAttachment?.extractionStatus).toBe("SUCCEEDED");
    expect(secondAttachment?.extractedPages).toEqual(firstAttachment?.extractedPages);

    const chainedFirst = await prisma.job.findUnique({ where: { idempotencyKey: processIncomingMessageIdempotencyKey(first.messageId) } });
    const chainedSecond = await prisma.job.findUnique({ where: { idempotencyKey: processIncomingMessageIdempotencyKey(second.messageId) } });
    if (chainedFirst) createdJobIds.push(chainedFirst.id);
    if (chainedSecond) createdJobIds.push(chainedSecond.id);
    await trackCaseFor(first.messageId);
    await trackCaseFor(second.messageId);
  });

  it("budget visione esaurito: un'immagine resta DEFERRED_BUDGET, mai un tentativo silenzioso di procedere; il retry ricorrente la risolve", async () => {
    await drainQueue();
    await ensureMailbox();
    const settingsBefore = await getRuleSettings();

    const { messageId, attachmentId } = await createMessageWithAttachment({
      providerMessageId: "EXTRACT-JOB-BUDGET-1",
      fileName: "foto.jpg",
      mimeType: "image/jpeg",
      content: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]),
    });

    try {
      await updateRuleSettings({ visionExtractionDailyBudgetUsd: 0 }, adminUserId);

      const { jobId } = await enqueueJob({
        type: "EXTRACT_ATTACHMENTS",
        payload: { emailMessageId: messageId },
        idempotencyKey: extractAttachmentsIdempotencyKey(messageId),
      });
      createdJobIds.push(jobId);
      await drainQueue();

      const reloaded = await prisma.attachment.findUniqueOrThrow({ where: { id: attachmentId } });
      expect(reloaded.extractionStatus).toBe("DEFERRED_BUDGET");
      expect(reloaded.isReadable).toBe(false);
      expect(reloaded.extractionError).toBeTruthy();

      // PROCESS_INCOMING_MESSAGE viene comunque accodato ed eseguito: mai bloccare l'intera
      // email per un allegato rinviato.
      const chainedJob = await prisma.job.findUniqueOrThrow({ where: { idempotencyKey: processIncomingMessageIdempotencyKey(messageId) } });
      createdJobIds.push(chainedJob.id);
      expect(chainedJob.status).toBe("SUCCEEDED");
      await trackCaseFor(messageId);

      // Ripristina il budget: il retry ricorrente deve risolvere l'allegato e riaccodare la pratica.
      await updateRuleSettings({ visionExtractionDailyBudgetUsd: settingsBefore.visionExtractionDailyBudgetUsd }, adminUserId);
      const { resolvedMessageIds } = await retryDeferredAttachmentExtractions();
      expect(resolvedMessageIds).toContain(messageId);

      const afterRetry = await prisma.attachment.findUniqueOrThrow({ where: { id: attachmentId } });
      expect(afterRetry.extractionStatus).not.toBe("DEFERRED_BUDGET");

      const reprocessJob = await prisma.job.findFirst({
        where: { idempotencyKey: processIncomingMessageIdempotencyKey(messageId), status: "PENDING" },
      });
      expect(reprocessJob).toBeTruthy();
      if (reprocessJob) {
        createdJobIds.push(reprocessJob.id);
        await drainQueue();
      }
    } finally {
      await updateRuleSettings({ visionExtractionDailyBudgetUsd: settingsBefore.visionExtractionDailyBudgetUsd }, adminUserId);
    }
  });
});
