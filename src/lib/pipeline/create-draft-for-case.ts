import type { Prisma } from "@/generated/prisma/client";
import type { LLMProvider } from "@/lib/adapters/llm/types";
import { writeAuditLog } from "./audit";

export interface CreateDraftForCaseParams {
  caseId: string;
  llmProvider: LLMProvider;
  /** null quando generata dall'arricchimento del seed (nessun utente umano ha premuto il bottone). */
  actorId: string | null;
}

/**
 * Genera e persiste una bozza di risposta (SPEC.md §11) in stato `PENDING_APPROVAL`: mai
 * inviata, richiede sempre approvazione umana esplicita (invariante 3). Usa solo dati già
 * verificati (CaseField, sintesi di classificazione) — mai il corpo grezzo delle email.
 */
export async function createDraftForCase(
  tx: Prisma.TransactionClient,
  { caseId, llmProvider, actorId }: CreateDraftForCaseParams,
): Promise<{ draftId: string }> {
  // Query sequenziali: una transazione interattiva Prisma è vincolata a un'unica connessione,
  // query concorrenti sulla stessa `tx` (Promise.all) non sono sicure.
  const caseRecord = await tx.case.findUniqueOrThrow({ where: { id: caseId }, include: { customer: true, supplier: true } });
  const fields = await tx.caseField.findMany({ where: { caseId } });

  const template = await tx.replyTemplate.findFirst({
    where: { isActive: true, OR: [{ category: caseRecord.category }, { category: null }] },
    orderBy: { category: "desc" },
  });

  const extractedFieldValues: Record<string, string | number | boolean | null> = {};
  for (const field of fields) {
    extractedFieldValues[field.fieldKey] = field.value;
  }

  const { data, usage, model } = await llmProvider.generateDraft({
    caseId,
    category: caseRecord.category,
    classificationSummary: caseRecord.summary,
    extractedFieldValues,
    templateSubject: template?.subject ?? null,
    templateBody: template?.bodyText ?? null,
  });
  void usage;
  void model;

  const toAddresses = caseRecord.customer?.email ? [caseRecord.customer.email] : caseRecord.supplier?.email ? [caseRecord.supplier.email] : [];

  const draft = await tx.emailDraft.create({
    data: {
      caseId,
      toAddresses,
      subject: data.subject,
      bodyText: data.body_text,
      placeholders: data.placeholders,
      generatedById: actorId,
    },
  });

  await writeAuditLog(tx, {
    action: "DRAFT_GENERATED",
    entityType: "EmailDraft",
    entityId: draft.id,
    caseId,
    actorId: actorId ?? undefined,
    metadata: { placeholders: data.placeholders, confidence: data.confidence },
  });

  return { draftId: draft.id };
}
