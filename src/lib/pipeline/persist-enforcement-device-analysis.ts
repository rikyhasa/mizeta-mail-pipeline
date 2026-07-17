import type { Prisma } from "@/generated/prisma/client";
import type { FieldSourceType } from "@/generated/prisma/enums";
import type { ProcessMessageResult } from "./types";

const DEVICE_FIELD_KEYS = ["manufacturer", "model", "version", "serial_number", "decree_number", "decree_date", "authority"] as const;

/**
 * Persiste l'analisi dispositivo autovelox (docs/SPEC-AUTOVELOX-DRAFT.md §4, §6, §7): passaggio
 * separato dall'estrazione principale, eseguito solo per pratiche FINE_OR_PENALTY con estrazione
 * riuscita. Applicability NOT_APPLICABLE non crea alcun `EnforcementDeviceCheck` — nessun modulo
 * da mostrare in UI per una pratica a cui non si applica. `needsHumanReview` è sempre forzato a
 * true alla creazione/aggiornamento: la classificazione del dispositivo richiede sempre conferma
 * umana, indipendentemente dalla confidenza del modello (docs/SPEC.md §10bis, CLAUDE.md invariante 9).
 */
export async function persistEnforcementDeviceAnalysis(
  tx: Prisma.TransactionClient,
  providerName: string,
  caseId: string,
  result: Pick<ProcessMessageResult, "enforcementDeviceAnalysis" | "now">,
): Promise<void> {
  const { enforcementDeviceAnalysis, now } = result;
  if (!enforcementDeviceAnalysis) return;

  const run = await tx.extractionRun.create({
    data: {
      caseId,
      llmProvider: providerName,
      model: enforcementDeviceAnalysis.model,
      status: "SUCCEEDED",
      resultJson: enforcementDeviceAnalysis.data as Prisma.InputJsonValue,
      inputTokens: enforcementDeviceAnalysis.usage.inputTokens,
      outputTokens: enforcementDeviceAnalysis.usage.outputTokens,
      costUsd: enforcementDeviceAnalysis.usage.costUsd,
      startedAt: now,
      finishedAt: now,
    },
  });

  const { data } = enforcementDeviceAnalysis;
  const applicability = data.applicability.value;
  // Il valore è nullable a schema (come ogni extracted field), ma l'euristica mock non lo
  // restituisce mai vuoto: nessun segnale ricade su NOT_APPLICABLE, non su null (vedi
  // schemas/enforcement-device-analysis.ts). Un null qui è comunque trattato come non applicabile:
  // nessun record da creare senza un'applicabilità concreta.
  if (applicability === null || applicability === "NOT_APPLICABLE") return;

  const check = await tx.enforcementDeviceCheck.upsert({
    where: { caseId },
    create: {
      caseId,
      applicability,
      needsHumanReview: true,
      extractionRunId: run.id,
    },
    update: {
      applicability,
      needsHumanReview: true,
      extractionRunId: run.id,
    },
  });

  for (const fieldKey of DEVICE_FIELD_KEYS) {
    const raw = data[fieldKey];
    const value = raw.value === null || raw.value === undefined ? null : String(raw.value);
    await tx.enforcementDeviceField.upsert({
      where: { checkId_fieldKey: { checkId: check.id, fieldKey } },
      create: {
        checkId: check.id,
        fieldKey,
        value,
        normalizedValue: raw.normalized_value,
        confidence: raw.confidence,
        sourceType: raw.source_type as FieldSourceType | null,
        sourceMessageId: raw.source_message_id,
        sourceAttachmentId: raw.source_attachment_id,
        sourcePage: raw.source_page,
        sourceExcerpt: raw.source_excerpt,
        needsHumanReview: raw.needs_human_review,
      },
      update: {
        value,
        normalizedValue: raw.normalized_value,
        confidence: raw.confidence,
        sourceType: raw.source_type as FieldSourceType | null,
        sourceMessageId: raw.source_message_id,
        sourceAttachmentId: raw.source_attachment_id,
        sourcePage: raw.source_page,
        sourceExcerpt: raw.source_excerpt,
        needsHumanReview: raw.needs_human_review,
      },
    });
  }
}
