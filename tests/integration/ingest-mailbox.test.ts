import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { ingestMailboxChanges, ingestRawMessage } from "@/lib/mail/ingest-mailbox";
import { resetCachedMailProvider } from "@/lib/adapters/mail/mail-provider-factory";
import { processIncomingMessageIdempotencyKey } from "@/lib/jobs/types";
import type { RawEmailMessage } from "@/lib/adapters/mail/types";
import { SEED_EMAILS } from "../../prisma/seed-data/emails";

const SEED_PEC_FIXTURE_COUNT = SEED_EMAILS.filter((f) => f.mailbox === "pec").length;

/**
 * `MockMailProviderAdapter` tiene un Set `processed` in memoria, condiviso da ogni chiamata a
 * `getCachedMailProvider()` nel processo di test: `resetCachedMailProvider()` forza una nuova
 * istanza (Set vuoto) prima di ogni test che deve rileggere gli stessi fixture "pec" da capo,
 * altrimenti un test successivo li vedrebbe già consumati da quello precedente.
 */
describe("Orchestratore di ingestione condiviso (src/lib/mail/ingest-mailbox.ts)", () => {
  const createdMailboxIds: string[] = [];
  const createdThreadIds: string[] = [];
  const createdMessageIds: string[] = [];
  const createdJobIds: string[] = [];

  afterAll(async () => {
    await prisma.job.deleteMany({ where: { id: { in: createdJobIds } } });
    await prisma.auditLog.deleteMany({ where: { entityType: "MailboxConnection", entityId: { in: createdMailboxIds } } });
    if (createdMessageIds.length > 0) await prisma.attachment.deleteMany({ where: { emailMessageId: { in: createdMessageIds } } });
    await prisma.emailMessage.deleteMany({ where: { mailboxConnectionId: { in: createdMailboxIds } } });
    if (createdThreadIds.length > 0) await prisma.emailThread.deleteMany({ where: { id: { in: createdThreadIds } } });
    if (createdMailboxIds.length > 0) await prisma.mailboxConnection.deleteMany({ where: { id: { in: createdMailboxIds } } });
    resetCachedMailProvider();
    await prisma.$disconnect();
  });

  function rawFixture(providerMessageId: string): RawEmailMessage {
    return {
      providerMessageId,
      providerThreadId: `thread-${providerMessageId}`,
      internetMessageId: `<${providerMessageId}@test.local>`,
      references: [],
      direction: "INBOUND",
      from: { address: "cliente@test-fixture.it" },
      to: ["mailbox@test-fixture.it"],
      cc: [],
      subject: "Messaggio di test",
      bodyText: "Corpo di test",
      receivedAt: new Date(),
      isPec: false,
      attachments: [],
    };
  }

  it("ingestRawMessage è deduplicato: la stessa (mailboxConnectionId, providerMessageId) non crea una seconda riga", async () => {
    const mailbox = await prisma.mailboxConnection.create({
      data: { provider: "MICROSOFT365", displayName: "Test Ingest Dedup", emailAddress: "test-ingest-dedup@mizeta.it", status: "CONNECTED", isPec: false, externalAccountId: "test-ingest-dedup" },
    });
    createdMailboxIds.push(mailbox.id);

    const raw = rawFixture("DEDUP-001");
    const first = await ingestRawMessage({ mailboxConnectionId: mailbox.id, raw, storageKeyPrefix: "test-ingest" });
    expect(first.created).toBe(true);
    createdMessageIds.push(first.emailMessageId);
    createdThreadIds.push((await prisma.emailMessage.findUniqueOrThrow({ where: { id: first.emailMessageId } })).threadId);

    const second = await ingestRawMessage({ mailboxConnectionId: mailbox.id, raw, storageKeyPrefix: "test-ingest" });
    expect(second.created).toBe(false);
    expect(second.emailMessageId).toBe(first.emailMessageId);

    const count = await prisma.emailMessage.count({ where: { mailboxConnectionId: mailbox.id, providerMessageId: "DEDUP-001" } });
    expect(count).toBe(1);
  });

  it("ingestMailboxChanges ingerisce i cambiamenti mock, aggiorna il cursore, scrive EMAIL_SYNCED e accoda la pipeline", async () => {
    resetCachedMailProvider();
    const mailbox = await prisma.mailboxConnection.create({
      data: { provider: "PEC_IMAP", displayName: "Test Ingest PEC", emailAddress: "test-ingest-pec@mizeta.legalmail.it", status: "CONNECTED", isPec: true, externalAccountId: "pec" },
    });
    createdMailboxIds.push(mailbox.id);

    const { processed, newMessageIds } = await ingestMailboxChanges(mailbox.id);
    expect(processed).toBeGreaterThan(0);
    expect(newMessageIds.length).toBe(processed);
    createdMessageIds.push(...newMessageIds);

    const messages = await prisma.emailMessage.findMany({ where: { id: { in: newMessageIds } } });
    createdThreadIds.push(...new Set(messages.map((m) => m.threadId)));

    const updatedMailbox = await prisma.mailboxConnection.findUniqueOrThrow({ where: { id: mailbox.id } });
    expect(updatedMailbox.lastSyncAt).toBeTruthy();
    expect(updatedMailbox.lastSyncCursor).toBeTruthy();

    const audit = await prisma.auditLog.findFirst({ where: { action: "EMAIL_SYNCED", entityId: mailbox.id } });
    expect(audit).toBeTruthy();

    for (const emailMessageId of newMessageIds) {
      const job = await prisma.job.findUnique({ where: { idempotencyKey: processIncomingMessageIdempotencyKey(emailMessageId) } });
      expect(job).toBeTruthy();
      if (job) createdJobIds.push(job.id);
    }
  });

  it("non duplica un messaggio già presente in DB anche se il provider lo ripropone come cambiamento", async () => {
    resetCachedMailProvider();
    const mailbox = await prisma.mailboxConnection.create({
      data: { provider: "PEC_IMAP", displayName: "Test Ingest PEC Preesistente", emailAddress: "test-ingest-pec-pre@mizeta.legalmail.it", status: "CONNECTED", isPec: true, externalAccountId: "pec" },
    });
    createdMailboxIds.push(mailbox.id);

    // EML-015 è un fixture "pec" reale (prisma/seed-data/emails.ts): lo pre-inseriamo per questa
    // mailbox come se fosse già stato ingerito in una sincronizzazione precedente.
    const preThread = await prisma.emailThread.create({
      data: { mailboxConnectionId: mailbox.id, providerThreadId: "pre-existing-thread", subject: "Già ingerito" },
    });
    createdThreadIds.push(preThread.id);
    const preExisting = await prisma.emailMessage.create({
      data: {
        mailboxConnectionId: mailbox.id,
        threadId: preThread.id,
        providerMessageId: "EML-015",
        direction: "INBOUND",
        fromAddress: "test@test-fixture.it",
        toAddresses: [],
        ccAddresses: [],
        subject: "Già ingerito",
        bodyText: "Già ingerito",
        receivedAt: new Date(),
        isPec: true,
      },
    });
    createdMessageIds.push(preExisting.id);

    const { processed, newMessageIds } = await ingestMailboxChanges(mailbox.id);
    expect(processed).toBe(SEED_PEC_FIXTURE_COUNT); // mock listChanges riporta tutti i fixture "pec" del seed
    expect(newMessageIds).not.toContain(preExisting.id);
    expect(newMessageIds.length).toBe(processed - 1); // EML-015 è già presente: non ri-creato

    createdMessageIds.push(...newMessageIds);
    const messages = await prisma.emailMessage.findMany({ where: { id: { in: newMessageIds } } });
    createdThreadIds.push(...new Set(messages.map((m) => m.threadId)));
    for (const emailMessageId of newMessageIds) {
      const job = await prisma.job.findUnique({ where: { idempotencyKey: processIncomingMessageIdempotencyKey(emailMessageId) } });
      if (job) createdJobIds.push(job.id);
    }

    const stillOne = await prisma.emailMessage.count({ where: { mailboxConnectionId: mailbox.id, providerMessageId: "EML-015" } });
    expect(stillOne).toBe(1);
  });
});
