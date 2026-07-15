import { SEED_EMAILS, type SeedEmailFixture } from "../../../../prisma/seed-data/emails";
import type {
  HealthStatus,
  MailChange,
  MailProviderAdapter,
  RawAttachment,
  RawEmailMessage,
} from "@/lib/adapters/mail/types";

function toRawMessage(fixture: SeedEmailFixture): RawEmailMessage {
  return {
    providerMessageId: fixture.id,
    providerThreadId: fixture.threadKey,
    internetMessageId: fixture.internetMessageId,
    inReplyTo: fixture.inReplyTo,
    references: fixture.inReplyTo ? [fixture.inReplyTo] : [],
    direction: fixture.direction,
    from: fixture.from,
    to: fixture.to,
    cc: fixture.cc ?? [],
    subject: fixture.subject,
    bodyText: fixture.bodyText,
    receivedAt: new Date(fixture.receivedAt),
    isPec: fixture.isPec,
    pecMessageType: fixture.pecMessageType,
    language: fixture.language,
    attachments: (fixture.attachments ?? []).map(
      (attachment): RawAttachment => ({
        id: attachment.id,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        isReadable: attachment.isReadable,
        content: attachment.contentPreviewText,
      }),
    ),
  };
}

/**
 * Full mock implementation of MailProviderAdapter (SPEC.md §3), required for the MVP.
 * Sources every message from prisma/seed-data/emails.ts, keyed by mailbox
 * ("info" | "pec"). `externalAccountId` is just that mailbox key.
 */
export class MockMailProviderAdapter implements MailProviderAdapter {
  private readonly processed = new Set<string>();

  private fixturesFor(externalAccountId: string): SeedEmailFixture[] {
    return SEED_EMAILS.filter((fixture) => fixture.mailbox === externalAccountId);
  }

  async connectAccount(input: {
    emailAddress: string;
    displayName: string;
    isPec?: boolean;
  }): Promise<{ externalAccountId: string }> {
    const externalAccountId = input.isPec ? "pec" : "info";
    return { externalAccountId };
  }

  async disconnectAccount(_externalAccountId: string): Promise<void> {
    // No-op: nothing to tear down for the mock.
  }

  async renewSubscription(_externalAccountId: string): Promise<{ expiresAt: Date }> {
    return { expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) };
  }

  async fetchMessage(externalAccountId: string, providerMessageId: string): Promise<RawEmailMessage> {
    const fixture = this.fixturesFor(externalAccountId).find((f) => f.id === providerMessageId);
    if (!fixture) {
      throw new Error(`Mock message not found: ${externalAccountId}/${providerMessageId}`);
    }
    return toRawMessage(fixture);
  }

  async fetchThread(externalAccountId: string, providerThreadId: string): Promise<RawEmailMessage[]> {
    return this.fixturesFor(externalAccountId)
      .filter((f) => f.threadKey === providerThreadId)
      .map(toRawMessage);
  }

  async fetchAttachment(
    externalAccountId: string,
    providerMessageId: string,
    attachmentId: string,
  ): Promise<RawAttachment> {
    const fixture = this.fixturesFor(externalAccountId).find((f) => f.id === providerMessageId);
    const attachment = fixture?.attachments?.find((a) => a.id === attachmentId);
    if (!attachment) {
      throw new Error(`Mock attachment not found: ${externalAccountId}/${providerMessageId}/${attachmentId}`);
    }
    return {
      id: attachment.id,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      isReadable: attachment.isReadable,
      content: attachment.contentPreviewText,
    };
  }

  async listChanges(
    externalAccountId: string,
    _cursor: string | null,
  ): Promise<{ changes: MailChange[]; nextCursor: string | null }> {
    const pending = this.fixturesFor(externalAccountId).filter((f) => !this.processed.has(f.id));
    const changes: MailChange[] = pending.map((fixture) => ({
      type: "created",
      providerMessageId: fixture.id,
      providerThreadId: fixture.threadKey,
    }));
    const nextCursor = changes.length > 0 ? changes[changes.length - 1].providerMessageId : null;
    return { changes, nextCursor };
  }

  async markProcessingResult(
    _externalAccountId: string,
    providerMessageId: string,
    result: { ok: boolean; error?: string },
  ): Promise<void> {
    if (result.ok) {
      this.processed.add(providerMessageId);
    }
  }

  async healthCheck(_externalAccountId: string): Promise<HealthStatus> {
    return { status: "ok", checkedAt: new Date() };
  }
}
