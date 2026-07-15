import type { CasePriority, CaseStatus } from "@/generated/prisma/enums";
import type { Rule, RuleBaseline, RuleContext, RuleEngineResult, RuleSettingsData } from "./types";
import { DEFAULT_RULES } from "./default-rules";

const PRIORITY_ORDER: CasePriority[] = ["LOW", "NORMAL", "HIGH", "CRITICAL"];

function escalatePriority(current: CasePriority, proposed: CasePriority): CasePriority {
  return PRIORITY_ORDER.indexOf(proposed) > PRIORITY_ORDER.indexOf(current) ? proposed : current;
}

/**
 * Motore di regole deterministico (SPEC.md §8). `baseline` viene sempre dalla classificazione
 * (passaggio 1): ogni regola può solo ESCALARE priority (mai downgrade) e needsHumanReview è un
 * OR monotono — il motore deterministico può sovrascrivere l'esito del modello, mai il
 * contrario. Lo status finale diventa NEEDS_REVIEW se richiesto da una regola, altrimenti resta
 * quello proposto in baseline (mai una regressione a NEW di una pratica già in lavorazione).
 */
export function applyRules(
  baseline: RuleBaseline,
  ctx: RuleContext,
  settings: RuleSettingsData,
  rules: Rule[] = DEFAULT_RULES,
): RuleEngineResult {
  let priority = baseline.priority;
  let needsHumanReview = baseline.needsHumanReview;
  const reasons: string[] = [...baseline.reasons];
  const triggeredRules: string[] = [];

  for (const rule of rules) {
    const outcome = rule.evaluate(ctx, settings);
    if (!outcome) continue;

    triggeredRules.push(rule.id);
    if (outcome.priority) priority = escalatePriority(priority, outcome.priority);
    if (outcome.needsHumanReview) needsHumanReview = true;
    if (outcome.reason) reasons.push(outcome.reason);
  }

  const status: CaseStatus = needsHumanReview ? "NEEDS_REVIEW" : baseline.status;

  return { priority, status, needsHumanReview, reasons, triggeredRules };
}
