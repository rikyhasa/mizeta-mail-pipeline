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
 * più recenti prima. La reference non ha filtri (tabella statica su 26 email mock) — qui,
 * oltre alla paginazione (necessaria perché il volume reale cresce nel tempo), un filtro per
 * categoria (FASE 3, rifinitura finale): riusa `Case.category`, lo stesso dato già mostrato
 * nella colonna "Categoria" della tabella, nessuna nuova query di dominio.
 */
export async function getIncomingMessages(
  page = 1,
  category?: CaseCategory,
): Promise<{ items: IncomingMessageListItem[]; total: number; confidenceThreshold: number }> {
  const where: Prisma.EmailMessageWhereInput = {
    direction: "INBOUND",
    ...(category ? { case: { category } } : {}),
  };

  const [settings, messages, total] = await Promise.all([
    getRuleSettings(),
    prisma.emailMessage.findMany({
      where,
      include: MESSAGE_LIST_INCLUDE,
      orderBy: { receivedAt: "desc" },
      skip: (Math.max(1, page) - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.emailMessage.count({ where }),
  ]);

  return {
    items: messages.map(mapMessageToListItem),
    total,
    confidenceThreshold: settings.classificationConfidenceThreshold,
  };
}
