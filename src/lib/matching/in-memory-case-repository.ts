import type { CaseCategory } from "@/generated/prisma/enums";
import type { AttachmentInput, ExtractionMessageInput } from "@/lib/adapters/llm/types";
import type { CaseRepository, OpenCaseSummary } from "./types";

interface StoredCase {
  caseId: string;
  category: CaseCategory;
  title: string;
  summary: string | null;
  invoiceNumbers: Set<string>;
  orderNumbers: Set<string>;
  shipmentReferences: Set<string>;
  fineNoticeNumbers: Set<string>;
}

interface StoredMessage {
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
}

/**
 * Implementazione in-memory di CaseRepository (SPEC.md §7): mai Postgres, usata da `eval/` e
 * dai test unitari dei livelli di matching. Chi la usa deve chiamare `recordCase`/`recordMessage`
 * dopo ogni esito di pipeline per rendere visibili le pratiche appena create ai messaggi
 * successivi, replicando ciò che in produzione fa la transazione Prisma dell'orchestratore.
 */
export class InMemoryCaseRepository implements CaseRepository {
  private readonly cases = new Map<string, StoredCase>();
  private readonly messages: StoredMessage[] = [];

  async findCaseByProviderThread(mailboxConnectionId: string, providerThreadId: string) {
    const match = this.messages.find((m) => m.mailboxConnectionId === mailboxConnectionId && m.providerThreadId === providerThreadId);
    return match ? { caseId: match.caseId } : null;
  }

  async findCaseByMessageIdentifiers(
    mailboxConnectionId: string,
    ids: { internetMessageId: string | null; inReplyTo: string | null; references: string[] },
  ) {
    const targets = [ids.internetMessageId, ids.inReplyTo, ...ids.references].filter((v): v is string => Boolean(v));
    if (targets.length === 0) return null;
    const match = this.messages.find(
      (m) => m.mailboxConnectionId === mailboxConnectionId && m.internetMessageId && targets.includes(m.internetMessageId),
    );
    return match ? { caseId: match.caseId } : null;
  }

  async findRecentMessageBySubject(mailboxConnectionId: string, subject: string, beforeDate: Date) {
    const candidates = this.messages
      .filter((m) => m.mailboxConnectionId === mailboxConnectionId && m.subject === subject && m.receivedAt <= beforeDate)
      .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
    return candidates.length > 0 ? { caseId: candidates[0].caseId } : null;
  }

  async findCaseByInvoiceNumber(invoiceNumber: string) {
    for (const c of this.cases.values()) {
      if (c.invoiceNumbers.has(invoiceNumber)) return { caseId: c.caseId, category: c.category };
    }
    return null;
  }

  async findCaseByOrderNumber(orderNumber: string) {
    for (const c of this.cases.values()) {
      if (c.orderNumbers.has(orderNumber)) return { caseId: c.caseId };
    }
    return null;
  }

  async findCaseByShipmentReference(reference: string) {
    for (const c of this.cases.values()) {
      if (c.shipmentReferences.has(reference)) return { caseId: c.caseId };
    }
    return null;
  }

  async findCaseByFineNoticeNumber(noticeNumber: string) {
    for (const c of this.cases.values()) {
      if (c.fineNoticeNumbers.has(noticeNumber)) return { caseId: c.caseId };
    }
    return null;
  }

  async findCaseBySameSenderRecently(input: {
    mailboxConnectionId: string;
    fromAddress: string;
    category: CaseCategory;
    aroundDate: Date;
    windowDays: number;
  }) {
    const windowMs = input.windowDays * 24 * 60 * 60 * 1000;
    const candidates = this.messages
      .filter(
        (m) =>
          m.mailboxConnectionId === input.mailboxConnectionId &&
          m.fromAddress === input.fromAddress &&
          Math.abs(m.receivedAt.getTime() - input.aroundDate.getTime()) <= windowMs &&
          this.cases.get(m.caseId)?.category === input.category,
      )
      .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
    return candidates.length > 0 ? { caseId: candidates[0].caseId } : null;
  }

  async listOpenCasesInCategory(category: CaseCategory): Promise<OpenCaseSummary[]> {
    return [...this.cases.values()]
      .filter((c) => c.category === category)
      .map((c) => ({ caseId: c.caseId, category: c.category, title: c.title, summary: c.summary }));
  }

  async recordCase(input: {
    caseId: string;
    category: CaseCategory;
    title: string;
    summary: string | null;
    invoiceNumbers: string[];
    orderNumbers: string[];
    shipmentReferences: string[];
    fineNoticeNumbers: string[];
  }): Promise<void> {
    const existing = this.cases.get(input.caseId);
    this.cases.set(input.caseId, {
      caseId: input.caseId,
      category: input.category,
      title: input.title,
      summary: input.summary,
      invoiceNumbers: new Set([...(existing?.invoiceNumbers ?? []), ...input.invoiceNumbers]),
      orderNumbers: new Set([...(existing?.orderNumbers ?? []), ...input.orderNumbers]),
      shipmentReferences: new Set([...(existing?.shipmentReferences ?? []), ...input.shipmentReferences]),
      fineNoticeNumbers: new Set([...(existing?.fineNoticeNumbers ?? []), ...input.fineNoticeNumbers]),
    });
  }

  async recordMessage(input: {
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
  }): Promise<void> {
    this.messages.push({ ...input });
  }

  /**
   * Non fa parte di CaseRepository: usata direttamente da eval/pipeline-demo per aggregare
   * l'estrazione senza toccare Postgres (equivalente in-memory di loadCaseMessages).
   */
  async getCaseMessages(caseId: string): Promise<ExtractionMessageInput[]> {
    return this.messages
      .filter((m) => m.caseId === caseId)
      .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime())
      .map((m) => ({
        emailMessageId: m.emailMessageId,
        subject: m.subject,
        bodyText: m.bodyText,
        receivedAt: m.receivedAt.toISOString(),
        attachments: m.attachments,
      }));
  }
}
