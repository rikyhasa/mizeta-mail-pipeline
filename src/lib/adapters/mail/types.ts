export interface RawAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  isReadable: boolean;
  content: Buffer | string;
}

export interface RawEmailMessage {
  providerMessageId: string;
  providerThreadId: string;
  internetMessageId?: string;
  inReplyTo?: string;
  references: string[];
  direction: "INBOUND" | "OUTBOUND";
  from: { name?: string; address: string };
  to: string[];
  cc: string[];
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  receivedAt: Date;
  sentAt?: Date;
  isPec: boolean;
  pecMessageType?: "MESSAGE" | "ACCEPTANCE_RECEIPT" | "DELIVERY_RECEIPT" | "NON_DELIVERY_RECEIPT";
  language?: string;
  attachments: RawAttachment[];
}

export interface MailChange {
  type: "created" | "updated";
  providerMessageId: string;
  providerThreadId: string;
}

export interface HealthStatus {
  status: "ok" | "degraded" | "error";
  message?: string;
  checkedAt: Date;
}

/**
 * Common interface for all email channels (SPEC.md §3): microsoft365, pec_imap, mock.
 * The MVP only implements `mock` fully; microsoft365/pec_imap arrive in Fase 4.
 */
export interface MailProviderAdapter {
  connectAccount(input: {
    emailAddress: string;
    displayName: string;
    isPec?: boolean;
  }): Promise<{ externalAccountId: string }>;

  disconnectAccount(externalAccountId: string): Promise<void>;

  renewSubscription(externalAccountId: string): Promise<{ expiresAt: Date }>;

  fetchMessage(externalAccountId: string, providerMessageId: string): Promise<RawEmailMessage>;

  fetchThread(externalAccountId: string, providerThreadId: string): Promise<RawEmailMessage[]>;

  fetchAttachment(
    externalAccountId: string,
    providerMessageId: string,
    attachmentId: string,
  ): Promise<RawAttachment>;

  listChanges(
    externalAccountId: string,
    cursor: string | null,
  ): Promise<{ changes: MailChange[]; nextCursor: string | null }>;

  markProcessingResult(
    externalAccountId: string,
    providerMessageId: string,
    result: { ok: boolean; error?: string },
  ): Promise<void>;

  healthCheck(externalAccountId: string): Promise<HealthStatus>;
}
