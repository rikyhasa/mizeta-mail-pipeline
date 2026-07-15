import type { CaseCategory, CasePriority } from "@/generated/prisma/enums";
import { normalizeDateExpression } from "@/lib/text/date-normalizer";
import type { EvalExpectation } from "./dataset";

export interface EvalRecord {
  fixtureId: string;
  category: CaseCategory;
  priority: CasePriority;
  needsHumanReview: boolean;
  securityFlags: string[];
  isPossibleDuplicateFlagged: boolean;
  fields: Record<string, unknown>;
  /** ISO della fixture, usata come riferimento per normalizzare le date grezze in `fields`
   * (SPEC.md §6, Fase 5): `fields` contiene il `value` testuale grezzo del modello (es.
   * "17/07/2026"), mai già normalizzato — senza questo riferimento un confronto diretto con
   * `expectedDeadlineField.isoDate` (sempre ISO) non potrebbe mai avere successo su un formato
   * italiano o relativo. */
  receivedAt: string;
}

export interface EvalMetrics {
  totalFixtures: number;
  primaryCategoryAccuracy: number;
  fineAndClaimUrgentRecall: number;
  amountAccuracy: number;
  deadlineAccuracy: number;
  needsReviewRate: number;
  duplicateRecall: number;
  duplicateFalsePositives: number;
  securityFlagsRecall: number;
  perFixture: { fixtureId: string; categoryOk: boolean; notes?: string }[];
}

function isUrgent(priority: CasePriority): boolean {
  return priority === "HIGH" || priority === "CRITICAL";
}

/** Metriche eval (SPEC.md §18), calcolate confrontando EVAL_DATASET con l'esito reale della pipeline. */
export function computeMetrics(records: EvalRecord[], dataset: EvalExpectation[]): EvalMetrics {
  const byId = new Map(records.map((r) => [r.fixtureId, r]));
  const perFixture: EvalMetrics["perFixture"] = [];

  let categoryCorrect = 0;
  let categoryTotal = 0;
  let urgentExpectedTotal = 0;
  let urgentCorrect = 0;
  let amountChecks = 0;
  let amountCorrect = 0;
  let deadlineChecks = 0;
  let deadlineCorrect = 0;
  let duplicateExpectedTotal = 0;
  let duplicateCorrect = 0;
  let duplicateFalsePositives = 0;
  let securityExpectedTotal = 0;
  let securityCorrect = 0;
  let needsReviewCount = 0;

  for (const expectation of dataset) {
    const record = byId.get(expectation.fixtureId);
    if (!record) {
      perFixture.push({ fixtureId: expectation.fixtureId, categoryOk: false, notes: "nessun risultato prodotto dalla pipeline" });
      continue;
    }

    const categoryOk = expectation.acceptablePrimaryCategories.includes(record.category);
    categoryTotal += 1;
    if (categoryOk) categoryCorrect += 1;

    if (expectation.expectedIsUrgent) {
      const isFineOrClaim = record.category === "FINE_OR_PENALTY" || record.category === "CLAIM_OR_DAMAGE";
      if (isFineOrClaim) {
        urgentExpectedTotal += 1;
        if (isUrgent(record.priority)) urgentCorrect += 1;
      }
    }

    if (expectation.expectedAmountField) {
      amountChecks += 1;
      const raw = record.fields[expectation.expectedAmountField.fieldKey];
      const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
      const tolerance = expectation.expectedAmountField.toleranceAbsolute ?? 0.5;
      if (Number.isFinite(value) && Math.abs(value - expectation.expectedAmountField.value) <= tolerance) amountCorrect += 1;
    }

    if (expectation.expectedDeadlineField) {
      deadlineChecks += 1;
      const { fieldKey, isoDate: expected } = expectation.expectedDeadlineField;
      const raw = record.fields[fieldKey];
      const normalize = (v: unknown) => (typeof v === "string" ? normalizeDateExpression(v, { referenceIso: record.receivedAt }) : null);

      if (expected === null) {
        if (raw === null || raw === undefined) deadlineCorrect += 1;
      } else if (normalize(raw)?.startsWith(expected)) {
        deadlineCorrect += 1;
      } else {
        // Fallback: il fieldKey atteso può mancare (categoria reale diversa da quella attesa)
        // o portare un valore che non normalizza alla data giusta — cerca la data attesa fra
        // tutti gli altri campi stringa estratti prima di contare un fallimento, per non
        // penalizzare una normalizzazione riuscita finita su un campo di un'altra categoria
        // (docs/evaluation.md §1.1, causa 1: effetto a cascata della classificazione).
        const foundElsewhere = Object.values(record.fields).some((v) => normalize(v)?.startsWith(expected));
        if (foundElsewhere) deadlineCorrect += 1;
      }
    }

    if (expectation.expectedPossibleDuplicate) {
      duplicateExpectedTotal += 1;
      if (record.isPossibleDuplicateFlagged) duplicateCorrect += 1;
    } else if (record.isPossibleDuplicateFlagged) {
      duplicateFalsePositives += 1;
    }

    if (expectation.expectedSecurityFlagsNonEmpty) {
      securityExpectedTotal += 1;
      if (record.securityFlags.length > 0) securityCorrect += 1;
    }

    if (record.needsHumanReview) needsReviewCount += 1;

    perFixture.push({ fixtureId: expectation.fixtureId, categoryOk, notes: expectation.notes });
  }

  return {
    totalFixtures: dataset.length,
    primaryCategoryAccuracy: categoryTotal > 0 ? categoryCorrect / categoryTotal : 0,
    fineAndClaimUrgentRecall: urgentExpectedTotal > 0 ? urgentCorrect / urgentExpectedTotal : 1,
    amountAccuracy: amountChecks > 0 ? amountCorrect / amountChecks : 1,
    deadlineAccuracy: deadlineChecks > 0 ? deadlineCorrect / deadlineChecks : 1,
    needsReviewRate: records.length > 0 ? needsReviewCount / records.length : 0,
    duplicateRecall: duplicateExpectedTotal > 0 ? duplicateCorrect / duplicateExpectedTotal : 1,
    duplicateFalsePositives,
    securityFlagsRecall: securityExpectedTotal > 0 ? securityCorrect / securityExpectedTotal : 1,
    perFixture,
  };
}
