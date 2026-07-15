import type { PrismaClient } from "@/generated/prisma/client";
import type { CaseCategory } from "@/generated/prisma/enums";
import type { CaseRepository, OpenCaseSummary } from "./types";

const SHIPMENT_REFERENCE_FIELD_KEYS = ["shipment_or_trip_reference", "loading_references", "unloading_references"];

/**
 * Implementazione Prisma di CaseRepository (SPEC.md §7). `recordCase`/`recordMessage` sono
 * no-op: lo stato reale viene scritto una sola volta dall'orchestratore, in un'unica
 * transazione (src/lib/pipeline/process-incoming-message.ts) — le letture successive vedono
 * direttamente Postgres, senza bisogno di uno stato in-memory parallelo.
 */
export class PrismaCaseRepository implements CaseRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findCaseByProviderThread(mailboxConnectionId: string, providerThreadId: string) {
    const message = await this.prisma.emailMessage.findFirst({
      where: { mailboxConnectionId, caseId: { not: null }, thread: { providerThreadId } },
      orderBy: { receivedAt: "desc" },
      select: { caseId: true },
    });
    return message?.caseId ? { caseId: message.caseId } : null;
  }

  async findCaseByMessageIdentifiers(
    mailboxConnectionId: string,
    ids: { internetMessageId: string | null; inReplyTo: string | null; references: string[] },
  ) {
    const targets = [ids.internetMessageId, ids.inReplyTo, ...ids.references].filter((v): v is string => Boolean(v));
    if (targets.length === 0) return null;
    const message = await this.prisma.emailMessage.findFirst({
      where: { mailboxConnectionId, caseId: { not: null }, internetMessageId: { in: targets } },
      orderBy: { receivedAt: "desc" },
      select: { caseId: true },
    });
    return message?.caseId ? { caseId: message.caseId } : null;
  }

  async findRecentMessageBySubject(mailboxConnectionId: string, subject: string, beforeDate: Date) {
    const message = await this.prisma.emailMessage.findFirst({
      where: { mailboxConnectionId, caseId: { not: null }, subject, receivedAt: { lte: beforeDate } },
      orderBy: { receivedAt: "desc" },
      select: { caseId: true },
    });
    return message?.caseId ? { caseId: message.caseId } : null;
  }

  private async findCaseByFieldValue(fieldKeys: string[], value: string) {
    const field = await this.prisma.caseField.findFirst({
      where: { fieldKey: { in: fieldKeys }, value },
      orderBy: { createdAt: "desc" },
      select: { caseId: true },
    });
    return field ? { caseId: field.caseId } : null;
  }

  async findCaseByInvoiceNumber(invoiceNumber: string) {
    const field = await this.prisma.caseField.findFirst({
      where: { fieldKey: "invoice_number", value: invoiceNumber },
      orderBy: { createdAt: "desc" },
      select: { caseId: true, case: { select: { category: true } } },
    });
    return field ? { caseId: field.caseId, category: field.case.category } : null;
  }

  findCaseByOrderNumber(orderNumber: string) {
    return this.findCaseByFieldValue(["order_number"], orderNumber);
  }

  findCaseByShipmentReference(reference: string) {
    return this.findCaseByFieldValue(SHIPMENT_REFERENCE_FIELD_KEYS, reference);
  }

  findCaseByFineNoticeNumber(noticeNumber: string) {
    return this.findCaseByFieldValue(["notice_number"], noticeNumber);
  }

  async findCaseBySameSenderRecently(input: {
    mailboxConnectionId: string;
    fromAddress: string;
    category: CaseCategory;
    aroundDate: Date;
    windowDays: number;
  }) {
    const windowMs = input.windowDays * 24 * 60 * 60 * 1000;
    const message = await this.prisma.emailMessage.findFirst({
      where: {
        mailboxConnectionId: input.mailboxConnectionId,
        fromAddress: input.fromAddress,
        caseId: { not: null },
        receivedAt: {
          gte: new Date(input.aroundDate.getTime() - windowMs),
          lte: new Date(input.aroundDate.getTime() + windowMs),
        },
        case: { category: input.category },
      },
      orderBy: { receivedAt: "desc" },
      select: { caseId: true },
    });
    return message?.caseId ? { caseId: message.caseId } : null;
  }

  async listOpenCasesInCategory(category: CaseCategory): Promise<OpenCaseSummary[]> {
    const cases = await this.prisma.case.findMany({
      where: { category, status: { notIn: ["COMPLETED", "ARCHIVED"] } },
      select: { id: true, category: true, title: true, summary: true },
    });
    return cases.map((c) => ({ caseId: c.id, category: c.category, title: c.title, summary: c.summary }));
  }

  async recordCase(): Promise<void> {
    // no-op: la scrittura avviene nella transazione dell'orchestratore.
  }

  async recordMessage(): Promise<void> {
    // no-op: la scrittura avviene nella transazione dell'orchestratore.
  }
}
