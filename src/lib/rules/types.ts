import type { CaseCategory, CasePriority, CaseStatus, DeadlineKind, Department } from "@/generated/prisma/enums";

export interface RuleSettingsData {
  classificationConfidenceThreshold: number;
  matchingAutoLinkConfidenceThreshold: number;
  matchingPossibleDuplicateConfidenceThreshold: number;
  deadlineCriticalWithinHours: number;
  fineReducedDeadlineCriticalWithinHours: number;
  claimAmountHighThreshold: number;
  quoteSameDayResponseWithinHours: number;
  amountMismatchTolerancePercent: number;
  /** Vuoto = tutte le categorie abilitate (SPEC.md §16). Solo configurazione in questa fase: non ancora applicato dalla pipeline. */
  enabledCategories: CaseCategory[];
  /** Override del reparto predefinito per categoria (fallback: PRIORITY_DEPARTMENT nel motore euristico). */
  defaultDepartmentByCategory: Partial<Record<CaseCategory, Department>> | null;
  /** Retention (SPEC.md §14, §16): giorni di conservazione. null = nessun limite. Non ancora applicato automaticamente (job Fase 4/5). */
  emailRetentionDays: number | null;
  attachmentRetentionDays: number | null;
  auditLogRetentionDays: number | null;
  /** Mittenti/cartelle esclusi dalla sincronizzazione (SPEC.md §14). Non ancora applicato: nessun adapter email reale in questa fase. */
  excludedSenderPatterns: string[];
}

export interface RuleDeadline {
  kind: DeadlineKind;
  dueAt: Date;
}

export interface RuleContext {
  category: CaseCategory;
  deadlines: RuleDeadline[];
  hasUnreadableAttachment: boolean;
  possibleDuplicate: boolean;
  amountMismatchDetected: boolean;
  ibanMismatch: boolean;
  claimRequestedAmount: number | null;
  quoteResponseDueAt: Date | null;
  classificationConfidence: number;
  now: Date;
}

export interface RuleBaseline {
  priority: CasePriority;
  status: CaseStatus;
  needsHumanReview: boolean;
  reasons: string[];
}

export interface RuleOutcome {
  priority?: CasePriority;
  needsHumanReview?: boolean;
  reason?: string;
}

export interface Rule {
  id: string;
  evaluate(ctx: RuleContext, settings: RuleSettingsData): RuleOutcome | null;
}

export interface RuleEngineResult {
  priority: CasePriority;
  status: CaseStatus;
  needsHumanReview: boolean;
  reasons: string[];
  triggeredRules: string[];
}
