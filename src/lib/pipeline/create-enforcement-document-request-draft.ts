import type { Prisma } from "@/generated/prisma/client";
import type { EnforcementDocumentType } from "@/generated/prisma/enums";
import { ENFORCEMENT_DOCUMENT_TYPE_LABELS } from "@/lib/i18n/labels";
import { writeAuditLog } from "./audit";

export interface CreateEnforcementDocumentRequestDraftParams {
  caseId: string;
  missingDocumentTypes: EnforcementDocumentType[];
  actorId: string;
}

/**
 * Bozza di richiesta documentazione tecnica mancante (docs/SPEC-AUTOVELOX-DRAFT.md §8) — a
 * differenza di create-draft-for-case.ts, non passa dall'LLM: il contenuto è un elenco
 * strutturato di tipi di documento noti (allowlist), nessuna sintesi da generare. Sempre
 * PENDING_APPROVAL, mai inviata (CLAUDE.md invariante 2/3).
 */
export async function createEnforcementDocumentRequestDraft(
  tx: Prisma.TransactionClient,
  { caseId, missingDocumentTypes, actorId }: CreateEnforcementDocumentRequestDraftParams,
): Promise<{ draftId: string }> {
  const caseRecord = await tx.case.findUniqueOrThrow({ where: { id: caseId }, include: { customer: true, supplier: true } });

  // Stesso fallback di create-draft-for-case.ts: senza cliente/fornitore collegato (tipico di
  // una multa: la controparte è l'ente mittente), la richiesta va al mittente dell'ultimo
  // messaggio in ingresso.
  let toAddresses = caseRecord.customer?.email ? [caseRecord.customer.email] : caseRecord.supplier?.email ? [caseRecord.supplier.email] : [];
  if (toAddresses.length === 0) {
    const lastInboundMessage = await tx.emailMessage.findFirst({ where: { caseId, direction: "INBOUND" }, orderBy: { receivedAt: "desc" } });
    if (lastInboundMessage?.fromAddress) toAddresses = [lastInboundMessage.fromAddress];
  }

  const documentList = missingDocumentTypes.map((t) => `- ${ENFORCEMENT_DOCUMENT_TYPE_LABELS[t]}`).join("\n");
  const subject = `Richiesta documentazione tecnica — pratica ${caseRecord.reference}`;
  const bodyText =
    `Gentile ente,\n\nin relazione alla pratica ${caseRecord.reference}, richiediamo cortesemente la seguente ` +
    `documentazione tecnica relativa al dispositivo di rilevamento della velocità:\n\n${documentList}\n\n` +
    "Restiamo in attesa di un Vostro riscontro.\n\nCordiali saluti.";

  const draft = await tx.emailDraft.create({
    data: { caseId, toAddresses, subject, bodyText, placeholders: [], generatedById: actorId },
  });

  await writeAuditLog(tx, {
    action: "DRAFT_GENERATED",
    entityType: "EmailDraft",
    entityId: draft.id,
    caseId,
    actorId,
    metadata: { context: "enforcement_document_request", documentTypes: missingDocumentTypes },
  });

  return { draftId: draft.id };
}
