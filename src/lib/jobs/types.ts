export interface IngestMailboxChangesPayload {
  mailboxConnectionId: string;
}

export interface ProcessIncomingMessagePayload {
  emailMessageId: string;
}

export interface RenewSubscriptionPayload {
  mailboxConnectionId: string;
}

export function ingestMailboxChangesIdempotencyKey(mailboxConnectionId: string): string {
  return `ingest-mailbox:${mailboxConnectionId}`;
}

export function processIncomingMessageIdempotencyKey(emailMessageId: string): string {
  return `process-message:${emailMessageId}`;
}

export function renewSubscriptionIdempotencyKey(mailboxConnectionId: string): string {
  return `renew-subscription:${mailboxConnectionId}`;
}
