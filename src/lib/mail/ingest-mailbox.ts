import { prisma } from "@/lib/db/prisma";
import { attachmentStorage } from "@/lib/storage/local-storage";
import { getCachedMailProvider } from "@/lib/adapters/mail/mail-provider-factory";
import type { RawEmailMessage } from "@/lib/adapters/mail/types";
import { writeAuditLog } from "@/lib/pipeline/audit";
import { enqueueJob } from "@/lib/jobs/queue";
import { extractAttachmentsIdempotencyKey, processIncomingMessageIdempotencyKey } from "@/lib/jobs/types";
import { computeContentHash } from "@/lib/attachments/content-hash";

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
}): Promise<{ emailMessageId: string; created: boolean; hasAttachments: boolean }> {
  const { mailboxConnectionId, raw, caseId = null, storageKeyPrefix = "mail" } = params;

  const already = await prisma.emailMessage.findUnique({
    where: {
      mailboxConnectionId_providerMessageId: { mailboxConnectionId, providerMessageId: raw.providerMessageId },
    },
  });
  if (already) return { emailMessageId: already.id, created: false, hasAttachments: raw.attachments.length > 0 };

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
    // contentHash calcolato subito, sui byte appena scritti: permette al job di estrazione
    // (FASE 10) di riusare un'estrazione già riuscita in passato (es. fattura duplicata) senza
    // rileggere lo storage prima di sapere se serve.
    const content = Buffer.isBuffer(attachment.content) ? attachment.content : Buffer.from(attachment.content);
    await prisma.attachment.create({
      data: {
        emailMessageId: message.id,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        storageKey,
        contentHash: computeContentHash(content),
        isReadable: attachment.isReadable,
      },
    });
  }

  return { emailMessageId: message.id, created: true, hasAttachments: raw.attachments.length > 0 };
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

  const newMessages: { emailMessageId: string; hasAttachments: boolean }[] = [];
  for (const change of changes) {
    const raw = await adapter.fetchMessage(mailbox.externalAccountId, change.providerMessageId);
    const { emailMessageId, created, hasAttachments } = await ingestRawMessage({ mailboxConnectionId, raw });
    if (created) newMessages.push({ emailMessageId, hasAttachments });
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
      metadata: { messagesProcessed: changes.length, newMessages: newMessages.length },
    });
  });

  // Un messaggio con allegati passa prima da EXTRACT_ATTACHMENTS (FASE 10,
  // docs/FASE-10-LETTURA-ALLEGATI.md: estrazione PRIMA della classificazione), che accoda
  // PROCESS_INCOMING_MESSAGE al proprio termine (src/lib/jobs/worker.ts) — mai i due job in
  // parallelo, altrimenti la classificazione leggerebbe testo non ancora estratto. Un
  // messaggio senza allegati salta il passaggio, nessun job inutile.
  for (const { emailMessageId, hasAttachments } of newMessages) {
    if (hasAttachments) {
      await enqueueJob({
        type: "EXTRACT_ATTACHMENTS",
        payload: { emailMessageId },
        idempotencyKey: extractAttachmentsIdempotencyKey(emailMessageId),
      });
    } else {
      await enqueueJob({
        type: "PROCESS_INCOMING_MESSAGE",
        payload: { emailMessageId },
        idempotencyKey: processIncomingMessageIdempotencyKey(emailMessageId),
      });
    }
  }

  return { processed: changes.length, newMessageIds: newMessages.map((m) => m.emailMessageId) };
}
