import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { enqueueJob } from "@/lib/jobs/queue";
import { runWorkerOnce } from "@/lib/jobs/worker";

/**
 * Coda job su Postgres (SPEC.md §3/§17): idempotenza, retry con backoff, dead-letter,
 * esclusività del claim concorrente. `claimNextJob` reclama il job PENDING più vecchio
 * dell'INTERA tabella, non uno specifico: ogni test che chiama `runWorkerOnce()` drena prima
 * la coda (`drainQueue`) per garantire che l'unico job PENDING rimasto sia il proprio, e ripulisce
 * subito dopo i job creati solo per ispezione (idempotenza/riarmo) così non restano PENDING a
 * "avvelenare" il claim del test successivo.
 */
describe("Job queue su Postgres", () => {
  const createdCaseIds: string[] = [];
  const createdMessageIds: string[] = [];
  const createdThreadIds: string[] = [];
  const createdMailboxIds: string[] = [];
  const createdJobIds: string[] = [];

  afterAll(async () => {
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
      await prisma.classificationRun.deleteMany({ where: { emailMessageId: { in: createdMessageIds } } });
      await prisma.emailMessage.deleteMany({ where: { id: { in: createdMessageIds } } });
    }
    if (createdCaseIds.length > 0) await prisma.case.deleteMany({ where: { id: { in: createdCaseIds } } });
    if (createdThreadIds.length > 0) await prisma.emailThread.deleteMany({ where: { id: { in: createdThreadIds } } });
    if (createdMailboxIds.length > 0) await prisma.mailboxConnection.deleteMany({ where: { id: { in: createdMailboxIds } } });
    await prisma.$disconnect();
  });

  /** Reclama ed esegue ogni job PENDING rimasto (di questo o altri file di test) finché la coda
   * non è vuota, cosicché il prossimo `runWorkerOnce()` del test corrente reclami di sicuro il
   * job appena creato da quel test, non un residuo altrui. */
  async function drainQueue(maxIterations = 100): Promise<void> {
    for (let i = 0; i < maxIterations; i += 1) {
      const { claimed } = await runWorkerOnce();
      if (!claimed) return;
    }
  }

  it("enqueueJob è idempotente: la stessa chiave con un job PENDING non ne crea uno nuovo", async () => {
    const key = `test-idempotency-${Date.now()}`;
    const first = await enqueueJob({ type: "PROCESS_INCOMING_MESSAGE", payload: { emailMessageId: "does-not-matter" }, idempotencyKey: key });
    createdJobIds.push(first.jobId);
    const second = await enqueueJob({ type: "PROCESS_INCOMING_MESSAGE", payload: { emailMessageId: "does-not-matter" }, idempotencyKey: key });

    expect(second.jobId).toBe(first.jobId);
    expect(second.created).toBe(false);
    expect(await prisma.job.count({ where: { idempotencyKey: key } })).toBe(1);

    await prisma.job.delete({ where: { id: first.jobId } });
  });

  it("riarma da zero un job in stato terminale (SUCCEEDED) con la stessa idempotencyKey", async () => {
    const key = `test-rearm-${Date.now()}`;
    const first = await enqueueJob({ type: "PROCESS_INCOMING_MESSAGE", payload: { emailMessageId: "x" }, idempotencyKey: key });
    createdJobIds.push(first.jobId);
    await prisma.job.update({ where: { id: first.jobId }, data: { status: "SUCCEEDED", attempts: 3 } });

    const second = await enqueueJob({ type: "PROCESS_INCOMING_MESSAGE", payload: { emailMessageId: "x" }, idempotencyKey: key });
    expect(second.jobId).toBe(first.jobId);

    const reloaded = await prisma.job.findUniqueOrThrow({ where: { id: first.jobId } });
    expect(reloaded.status).toBe("PENDING");
    expect(reloaded.attempts).toBe(0);

    await prisma.job.delete({ where: { id: first.jobId } });
  });

  it("runWorkerOnce reclama ed esegue con successo un job PROCESS_INCOMING_MESSAGE valido", async () => {
    await drainQueue();

    const mailbox = await prisma.mailboxConnection.create({
      data: { provider: "MICROSOFT365", displayName: "Test Job Queue", emailAddress: "test-jobqueue@mizeta.it", status: "CONNECTED", isPec: false, externalAccountId: "test-jobqueue" },
    });
    createdMailboxIds.push(mailbox.id);
    const thread = await prisma.emailThread.create({ data: { mailboxConnectionId: mailbox.id, providerThreadId: "jq-thread-1", subject: "Test" } });
    createdThreadIds.push(thread.id);
    const message = await prisma.emailMessage.create({
      data: {
        mailboxConnectionId: mailbox.id,
        threadId: thread.id,
        providerMessageId: "JQ-001",
        direction: "INBOUND",
        fromAddress: "cliente@test-fixture.it",
        toAddresses: ["test-jobqueue@mizeta.it"],
        ccAddresses: [],
        subject: "Fattura FAT-2099-7777",
        bodyText: "In allegato la fattura FAT-2099-7777. Imponibile 10,00 EUR, IVA 2,20 EUR, totale 12,20 EUR. Scadenza 01/10/2026.",
        receivedAt: new Date(),
        isPec: false,
        hasAttachments: false,
      },
    });
    createdMessageIds.push(message.id);

    const { jobId } = await enqueueJob({
      type: "PROCESS_INCOMING_MESSAGE",
      payload: { emailMessageId: message.id },
      idempotencyKey: `test-jq-success-${message.id}`,
    });

    const { claimed, jobId: claimedJobId } = await runWorkerOnce();
    expect(claimed).toBe(true);
    expect(claimedJobId).toBe(jobId);

    const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.status).toBe("SUCCEEDED");
    const attempts = await prisma.jobAttempt.findMany({ where: { jobId } });
    expect(attempts).toHaveLength(1);
    expect(attempts[0].status).toBe("SUCCEEDED");

    const updatedMessage = await prisma.emailMessage.findUniqueOrThrow({ where: { id: message.id } });
    expect(updatedMessage.caseId).toBeTruthy();
    createdCaseIds.push(updatedMessage.caseId!);

    await prisma.jobAttempt.deleteMany({ where: { jobId } });
    await prisma.job.delete({ where: { id: jobId } });
  });

  it("in caso di fallimento, ripianifica con backoff finché non esaurisce i tentativi", async () => {
    await drainQueue();

    const job = await prisma.job.create({
      data: {
        type: "PROCESS_INCOMING_MESSAGE",
        payload: { emailMessageId: "non-esiste-e-non-deve-esistere" },
        idempotencyKey: `test-retry-${Date.now()}`,
        maxAttempts: 3,
      },
    });

    const before = Date.now();
    const { claimed, jobId } = await runWorkerOnce();
    expect(claimed).toBe(true);
    expect(jobId).toBe(job.id);

    const reloaded = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(reloaded.status).toBe("PENDING");
    expect(reloaded.attempts).toBe(1);
    expect(reloaded.lastError).toBeTruthy();
    expect(reloaded.nextRunAt.getTime()).toBeGreaterThan(before);

    await prisma.jobAttempt.deleteMany({ where: { jobId: job.id } });
    await prisma.job.delete({ where: { id: job.id } });
  });

  it("dopo aver esaurito i tentativi, passa a DEAD_LETTER e scrive l'audit JOB_DEAD_LETTERED", async () => {
    await drainQueue();

    const job = await prisma.job.create({
      data: {
        type: "PROCESS_INCOMING_MESSAGE",
        payload: { emailMessageId: "non-esiste-e-non-deve-esistere" },
        idempotencyKey: `test-dead-letter-${Date.now()}`,
        maxAttempts: 1,
      },
    });

    const { jobId } = await runWorkerOnce();
    expect(jobId).toBe(job.id);

    const reloaded = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(reloaded.status).toBe("DEAD_LETTER");

    const audit = await prisma.auditLog.findFirst({ where: { action: "JOB_DEAD_LETTERED", entityId: job.id } });
    expect(audit).toBeTruthy();

    await prisma.auditLog.deleteMany({ where: { action: "JOB_DEAD_LETTERED", entityId: job.id } });
    await prisma.jobAttempt.deleteMany({ where: { jobId: job.id } });
    await prisma.job.delete({ where: { id: job.id } });
  });

  it("chiamate concorrenti non elaborano mai due volte lo stesso job (SELECT ... FOR UPDATE SKIP LOCKED)", async () => {
    await drainQueue();

    const job = await prisma.job.create({
      data: {
        type: "PROCESS_INCOMING_MESSAGE",
        payload: { emailMessageId: "non-esiste-neanche-questo" },
        idempotencyKey: `test-concurrent-${Date.now()}`,
        maxAttempts: 5,
      },
    });

    // 5 chiamate concorrenti, non solo 2: la proprietà da verificare è che il job non venga MAI
    // reclamato più di una volta in questo giro (mai `attempts` >= 2), non che debba per forza
    // essere reclamato entro questa finestra — se nessuna delle 5 lo reclama per un timing
    // sfortunato, il prossimo poll del worker lo riprenderebbe comunque (nessuna violazione di
    // sicurezza, solo un ciclo di poll in più).
    await Promise.all(Array.from({ length: 5 }, () => runWorkerOnce()));

    const reloaded = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(reloaded.attempts).toBeLessThanOrEqual(1);

    await prisma.jobAttempt.deleteMany({ where: { jobId: job.id } });
    await prisma.job.delete({ where: { id: job.id } });
  });
});
