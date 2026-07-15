import type { RawAttachment, RawEmailMessage } from "@/lib/adapters/mail/types";

/** Selezione minima per identificare un messaggio nelle liste/delta (SPEC.md §3: listChanges
 * ritorna solo identificatori, il contenuto arriva da una fetchMessage separata). */
export const GRAPH_CHANGE_SELECT = "id,conversationId";

/** Selezione completa per `fetchMessage`/`fetchThread`. `internetMessageHeaders` è richiesto
 * esplicitamente per poter leggere In-Reply-To/References (Graph non li espone come campi
 * separati). L'header `Prefer: outlook.body-content-type="text"` (vedi GRAPH_TEXT_BODY_HEADER)
 * fa sì che `body.content` sia testo semplice, non HTML. */
export const GRAPH_MESSAGE_SELECT =
  "id,conversationId,internetMessageId,internetMessageHeaders,from,toRecipients,ccRecipients,subject,body,receivedDateTime,sentDateTime,hasAttachments";

export const GRAPH_TEXT_BODY_HEADER = { Prefer: 'outlook.body-content-type="text"' };

export interface GraphEmailAddress {
  emailAddress?: { name?: string; address?: string };
}

export interface GraphMessageHeader {
  name: string;
  value: string;
}

export interface GraphMessage {
  id: string;
  conversationId?: string;
  internetMessageId?: string;
  internetMessageHeaders?: GraphMessageHeader[];
  from?: GraphEmailAddress;
  toRecipients?: GraphEmailAddress[];
  ccRecipients?: GraphEmailAddress[];
  subject?: string;
  body?: { contentType: "text" | "html"; content: string };
  receivedDateTime?: string;
  sentDateTime?: string;
  hasAttachments?: boolean;
}

export interface GraphFileAttachment {
  id: string;
  name: string;
  contentType?: string;
  size?: number;
  contentBytes?: string;
  "@odata.type"?: string;
}

export interface GraphSubscription {
  id: string;
  resource: string;
  expirationDateTime: string;
  clientState: string;
}

export interface GraphMessagePage {
  value: GraphMessage[];
  "@odata.nextLink"?: string;
}

export interface GraphDeltaPage {
  value: GraphMessage[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
}

function findHeader(headers: GraphMessageHeader[] | undefined, name: string): string | undefined {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
}

function parseReferencesHeader(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(/\s+/).filter(Boolean);
}

/**
 * Mappa un `message` resource di Graph in `RawEmailMessage` (SPEC.md §3). `direction` è dedotta
 * confrontando il mittente con l'indirizzo della mailbox collegata — Graph non espone un campo
 * "direction" diretto. `isPec`/`pecMessageType` sono sempre `false`/assenti: microsoft365 non è
 * mai un canale PEC (SPEC.md §3: la PEC è esclusivamente `pec_imap`).
 */
export function mapGraphMessageToRaw(message: GraphMessage, mailboxEmailAddress: string): RawEmailMessage {
  const fromAddress = message.from?.emailAddress?.address ?? "";
  const direction: "INBOUND" | "OUTBOUND" =
    fromAddress.toLowerCase() === mailboxEmailAddress.toLowerCase() ? "OUTBOUND" : "INBOUND";

  return {
    providerMessageId: message.id,
    providerThreadId: message.conversationId ?? message.id,
    internetMessageId: message.internetMessageId,
    inReplyTo: findHeader(message.internetMessageHeaders, "In-Reply-To"),
    references: parseReferencesHeader(findHeader(message.internetMessageHeaders, "References")),
    direction,
    from: { name: message.from?.emailAddress?.name, address: fromAddress },
    to: (message.toRecipients ?? []).map((r) => r.emailAddress?.address ?? "").filter(Boolean),
    cc: (message.ccRecipients ?? []).map((r) => r.emailAddress?.address ?? "").filter(Boolean),
    subject: message.subject ?? "",
    bodyText: message.body?.content ?? "",
    bodyHtml: message.body?.contentType === "html" ? message.body.content : undefined,
    receivedAt: message.receivedDateTime ? new Date(message.receivedDateTime) : new Date(),
    sentAt: message.sentDateTime ? new Date(message.sentDateTime) : undefined,
    isPec: false,
    language: undefined,
    attachments: [],
  };
}

/**
 * Mappa un `fileAttachment` Graph in `RawAttachment`. Gli allegati non-file (`itemAttachment`,
 * `referenceAttachment`) o senza `contentBytes` diventano `isReadable: false` — mai inventare
 * contenuto (CLAUDE.md invariante 6).
 */
export function mapGraphAttachmentToRaw(attachment: GraphFileAttachment): RawAttachment {
  const isFileAttachment =
    attachment["@odata.type"] === undefined || attachment["@odata.type"] === "#microsoft.graph.fileAttachment";
  if (!isFileAttachment || !attachment.contentBytes) {
    return {
      id: attachment.id,
      fileName: attachment.name,
      mimeType: attachment.contentType ?? "application/octet-stream",
      sizeBytes: attachment.size ?? 0,
      isReadable: false,
      content: "",
    };
  }
  return {
    id: attachment.id,
    fileName: attachment.name,
    mimeType: attachment.contentType ?? "application/octet-stream",
    sizeBytes: attachment.size ?? 0,
    isReadable: true,
    content: Buffer.from(attachment.contentBytes, "base64"),
  };
}
