import { prisma } from "@/lib/db/prisma";
import { getRuleSettings } from "@/lib/rules/settings-repository";
import { PAGE_SIZE } from "@/lib/dashboard/constants";
import type { Prisma } from "@/generated/prisma/client";
import type { CaseCategory } from "@/generated/prisma/enums";

export interface IncomingMessageListItem {
  id: string;
  subject: string;
  fromName: string | null;
  fromAddress: string;
  receivedAt: Date;
  isPec: boolean;
  securityFlagsCount: number;
  attachmentsCount: number;
  /** null quando il messaggio non è (ancora) collegato a una pratica — raro nel flusso reale
   * (la pipeline classifica e collega in modo sincrono all'ingest), ma va gestito: categoria e
   * confidenza vivono su `Case`, non su `EmailMessage` (differenza rispetto al modello mock
   * della reference, dove ogni email appartiene sempre a una pratica). */
  category: CaseCategory | null;
  confidence: number | null;
  caseId: string | null;
  caseReference: string | null;
}

const MESSAGE_LIST_INCLUDE = {
  case: { select: { id: true, reference: true, category: true, confidence: true } },
  attachments: { select: { id: true } },
} satisfies Prisma.EmailMessageInclude;

type MessageWithListRelations = Prisma.EmailMessageGetPayload<{ include: typeof MESSAGE_LIST_INCLUDE }>;

function mapMessageToListItem(m: MessageWithListRelations): IncomingMessageListItem {
  const securityFlags = Array.isArray(m.securityFlags) ? (m.securityFlags as unknown[]) : [];
  return {
    id: m.id,
    subject: m.subject,
    fromName: m.fromName,
    fromAddress: m.fromAddress,
    receivedAt: m.receivedAt,
    isPec: m.isPec,
    securityFlagsCount: securityFlags.length,
    attachmentsCount: m.attachments.length,
    category: m.case?.category ?? null,
    confidence: m.case?.confidence ?? null,
    caseId: m.case?.id ?? null,
    caseReference: m.case?.reference ?? null,
  };
}

/**
 * "Posta acquisita": messaggi realmente acquisiti (`EmailMessage`, direzione INBOUND),
 * più recenti prima. Nessun filtro nella reference (tabella statica su 26 email mock) — qui
 * solo paginazione, necessaria perché il volume reale cresce nel tempo a differenza del seed
 * fisso della reference.
 */
export async function getIncomingMessages(page = 1): Promise<{ items: IncomingMessageListItem[]; total: number; confidenceThreshold: number }> {
  const [settings, messages, total] = await Promise.all([
    getRuleSettings(),
    prisma.emailMessage.findMany({
      where: { direction: "INBOUND" },
      include: MESSAGE_LIST_INCLUDE,
      orderBy: { receivedAt: "desc" },
      skip: (Math.max(1, page) - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.emailMessage.count({ where: { direction: "INBOUND" } }),
  ]);

  return {
    items: messages.map(mapMessageToListItem),
    total,
    confidenceThreshold: settings.classificationConfidenceThreshold,
  };
}
