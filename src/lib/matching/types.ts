import type { CaseCategory, PecMessageType } from "@/generated/prisma/enums";
import type { AttachmentInput } from "@/lib/adapters/llm/types";

export interface MatchEmailInput {
  mailboxConnectionId: string;
  providerThreadId: string;
  internetMessageId: string | null;
  inReplyTo: string | null;
  references: string[];
  isPec: boolean;
  pecMessageType: PecMessageType | null;
  fromAddress: string;
  subject: string;
  bodyText: string;
  receivedAt: Date;
  /** Categoria proposta dal passaggio 1 (classificazione), già disponibile prima del matching. */
  category: CaseCategory;
}

export type MatchLevel =
  | "pec_receipt"
  | "provider_thread"
  | "message_id"
  | "invoice_number"
  | "order_number"
  | "shipment_number"
  | "fine_number"
  | "recent_sender"
  | "semantic_similarity"
  | "none";

export interface WeakMatchCandidate {
  caseId: string;
  confidence: number;
  level: MatchLevel;
}

export interface MatchResult {
  caseId: string | null;
  level: MatchLevel;
  confidence: number;
  isPecReceipt: boolean;
  /** Se il match più forte trovato è sotto la soglia di auto-link: candidato per la coda duplicati. */
  possibleDuplicateOf?: WeakMatchCandidate;
}

export interface MatchSettings {
  autoLinkConfidenceThreshold: number;
  possibleDuplicateConfidenceThreshold: number;
}

export interface OpenCaseSummary {
  caseId: string;
  category: CaseCategory;
  title: string;
  summary: string | null;
}

/**
 * Accesso ai dati per il motore di matching (SPEC.md §7). Sola lettura più due metodi di
 * registrazione usati SOLO dall'implementazione in-memory (eval, test): `PrismaCaseRepository`
 * li implementa come no-op perché lo stato reale viene scritto altrove, in un'unica transazione
 * dall'orchestratore.
 */
export interface CaseRepository {
  findCaseByProviderThread(mailboxConnectionId: string, providerThreadId: string): Promise<{ caseId: string } | null>;

  findCaseByMessageIdentifiers(
    mailboxConnectionId: string,
    ids: { internetMessageId: string | null; inReplyTo: string | null; references: string[] },
  ): Promise<{ caseId: string } | null>;

  findRecentMessageBySubject(mailboxConnectionId: string, subject: string, beforeDate: Date): Promise<{ caseId: string } | null>;

  findCaseByInvoiceNumber(invoiceNumber: string): Promise<{ caseId: string; category: CaseCategory } | null>;
  findCaseByOrderNumber(orderNumber: string): Promise<{ caseId: string } | null>;
  findCaseByShipmentReference(reference: string): Promise<{ caseId: string } | null>;
  findCaseByFineNoticeNumber(noticeNumber: string): Promise<{ caseId: string } | null>;

  /**
   * Proxy semplificato del livello "cliente + tratta + intervallo temporale" (SPEC.md §7):
   * stesso mittente, stessa categoria, entro una finestra temporale. Non confronta la tratta
   * (origine/destinazione), dato non disponibile prima dell'estrazione — limitazione nota.
   */
  findCaseBySameSenderRecently(input: {
    mailboxConnectionId: string;
    fromAddress: string;
    category: CaseCategory;
    aroundDate: Date;
    windowDays: number;
  }): Promise<{ caseId: string } | null>;

  listOpenCasesInCategory(category: CaseCategory): Promise<OpenCaseSummary[]>;

  recordCase(input: {
    caseId: string;
    category: CaseCategory;
    title: string;
    summary: string | null;
    invoiceNumbers: string[];
    orderNumbers: string[];
    shipmentReferences: string[];
    fineNoticeNumbers: string[];
  }): Promise<void>;

  recordMessage(input: {
    caseId: string;
    emailMessageId: string;
    mailboxConnectionId: string;
    providerThreadId: string;
    internetMessageId: string | null;
    subject: string;
    bodyText: string;
    fromAddress: string;
    receivedAt: Date;
    attachments: AttachmentInput[];
  }): Promise<void>;
}
