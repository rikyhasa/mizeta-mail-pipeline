export interface IngestMailboxChangesPayload {
  mailboxConnectionId: string;
}

export interface ProcessIncomingMessagePayload {
  emailMessageId: string;
}

export interface ExtractAttachmentsPayload {
  emailMessageId: string;
}

/** Nessun dato di input: un solo job ricorrente di retry, stessa idempotencyKey (stesso
 * pattern di SyncSpeedDeviceRegistryPayload). */
export type RetryDeferredAttachmentExtractionsPayload = Record<string, never>;

export interface RenewSubscriptionPayload {
  mailboxConnectionId: string;
}

/** Nessun dato di input: un solo job ricorrente, sempre la stessa chiave di idempotenza
 * (docs/SPEC-AUTOVELOX-DRAFT.md §7bis) — un'unica sincronizzazione del registro MIT alla volta. */
export type SyncSpeedDeviceRegistryPayload = Record<string, never>;

export function ingestMailboxChangesIdempotencyKey(mailboxConnectionId: string): string {
  return `ingest-mailbox:${mailboxConnectionId}`;
}

export function processIncomingMessageIdempotencyKey(emailMessageId: string): string {
  return `process-message:${emailMessageId}`;
}

export function extractAttachmentsIdempotencyKey(emailMessageId: string): string {
  return `extract-attachments:${emailMessageId}`;
}

export function retryDeferredAttachmentExtractionsIdempotencyKey(): string {
  return "retry-deferred-attachment-extractions";
}

export function renewSubscriptionIdempotencyKey(mailboxConnectionId: string): string {
  return `renew-subscription:${mailboxConnectionId}`;
}

export function syncSpeedDeviceRegistryIdempotencyKey(): string {
  return "speed-registry-sync";
}
