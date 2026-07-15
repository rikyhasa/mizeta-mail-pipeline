import { prisma } from "@/lib/db/prisma";
import { attachmentStorage } from "@/lib/storage/local-storage";
import { getCachedMailProvider } from "@/lib/adapters/mail/mail-provider-factory";
import type { RawEmailMessage } from "@/lib/adapters/mail/types";
import { writeAuditLog } from "@/lib/pipeline/audit";
import { enqueueJob } from "@/lib/jobs/queue";
import { processIncomingMessageIdempotencyKey } from "@/lib/jobs/types";

/**
 * Primitiva "un raw message → righe DB" (SPEC.md §3: idempotenza/deduplicazione tramite
 * identificatori del provider). Dedup via `@@unique([mailboxConnectionId, providerMessageId])`
 * già esistente sullo schema: se il messaggio è già stato ingerito, no-op (`created: false`),
 * mai un errore di violazione di unicità.
 *
 * `caseId` è opzionale: l'ingestione reale (ingestMailboxChanges) lo lascia assente (il
 * matching reale lo assegna dopo, dentro `processIncomingMessage`); `prisma/seed.ts` lo passa
 * esplicitamente per i propri dati sintetici deterministici, bypassando deliberatamente il
 * matching reale.
 */
export async function ingestRawMessage(params: {
  mailboxConnectionId: string;
  raw: RawEmailMessage;
  caseId?: string | null;
  storageKeyPrefix?: string;
}): Promise<{ emailMessageId: string; created: boolean }> {
  const { mailboxConnectionId, raw, caseId = null, storageKeyPrefix = "mail" } = params;

  const already = await prisma.emailMessage.findUnique({
    where: {
      mailboxConnectionId_providerMessageId: { mailboxConnectionId, providerMessageId: raw.providerMessageId },
    },
  });
  if (already) return { emailMessageId: already.id, created: false };

  const thread = await prisma.emailThread.upsert({
    where: {
      mailboxConnectionId_providerThreadId: { mailboxConnectionId, providerThreadId: raw.providerThreadId },
    },
    update: {},
    create: { mailboxConnectionId, providerThreadId: raw.providerThreadId, subject: raw.subject },
  });

  const message = await prisma.emailMessage.create({
    data: {
      mailboxConnectionId,
      threadId: thread.id,
      caseId: caseId ?? undefined,
      providerMessageId: raw.providerMessageId,
      internetMessageId: raw.internetMessageId,
      inReplyTo: raw.inReplyTo,
      references: raw.references,
      direction: raw.direction,
      fromAddress: raw.from.address,
      fromName: raw.from.name,
      toAddresses: raw.to,
      ccAddresses: raw.cc,
      subject: raw.subject,
      bodyText: raw.bodyText,
      bodyHtml: raw.bodyHtml,
      receivedAt: raw.receivedAt,
      sentAt: raw.sentAt,
      isPec: raw.isPec,
      pecMessageType: raw.pecMessageType,
      language: raw.language,
      hasAttachments: raw.attachments.length > 0,
    },
  });

  for (const attachment of raw.attachments) {
    const storageKey = `${storageKeyPrefix}/${message.id}/${attachment.fileName}`;
    await attachmentStorage.put(storageKey, attachment.content);
    await prisma.attachment.create({
      data: {
        emailMessageId: message.id,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        storageKey,
        isReadable: attachment.isReadable,
      },
    });
  }

  return { emailMessageId: message.id, created: true };
}

/**
 * Orchestratore di ingestione condiviso (SPEC.md §3): usato dalla route "Sincronizza ora",
 * dal job worker (INGEST_MAILBOX_CHANGES) e da `scripts/pipeline-demo.ts`. Chiama
 * `listChanges` con il cursore persistito, ingerisce ogni cambiamento, aggiorna
 * `lastSyncCursor`, scrive l'audit `EMAIL_SYNCED`, e accoda `PROCESS_INCOMING_MESSAGE` per
 * ogni messaggio NUOVO — non chiama mai `processIncomingMessage` direttamente: disaccoppia
 * l'ingestione dai retry della pipeline/LLM.
 */
export async function ingestMailboxChanges(mailboxConnectionId: string): Promise<{ processed: number; newMessageIds: string[] }> {
  const mailbox = await prisma.mailboxConnection.findUniqueOrThrow({ where: { id: mailboxConnectionId } });
  if (!mailbox.externalAccountId) {
    throw new Error(`MailboxConnection ${mailboxConnectionId} non ha un externalAccountId: connectAccount non ancora eseguito.`);
  }

  const adapter = getCachedMailProvider();
  const { changes, nextCursor } = await adapter.listChanges(mailbox.externalAccountId, mailbox.lastSyncCursor);

  const newMessageIds: string[] = [];
  for (const change of changes) {
    const raw = await adapter.fetchMessage(mailbox.externalAccountId, change.providerMessageId);
    const { emailMessageId, created } = await ingestRawMessage({ mailboxConnectionId, raw });
    if (created) newMessageIds.push(emailMessageId);
    await adapter.markProcessingResult(mailbox.externalAccountId, change.providerMessageId, { ok: true });
  }

  await prisma.$transaction(async (tx) => {
    await tx.mailboxConnection.update({
      where: { id: mailboxConnectionId },
      data: { lastSyncAt: new Date(), lastSyncCursor: nextCursor },
    });
    await writeAuditLog(tx, {
      action: "EMAIL_SYNCED",
      entityType: "MailboxConnection",
      entityId: mailboxConnectionId,
      metadata: { messagesProcessed: changes.length, newMessages: newMessageIds.length },
    });
  });

  for (const emailMessageId of newMessageIds) {
    await enqueueJob({
      type: "PROCESS_INCOMING_MESSAGE",
      payload: { emailMessageId },
      idempotencyKey: processIncomingMessageIdempotencyKey(emailMessageId),
    });
  }

  return { processed: changes.length, newMessageIds };
}
