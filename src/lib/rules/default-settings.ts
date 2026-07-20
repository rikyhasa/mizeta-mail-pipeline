import type { RuleSettingsData } from "./types";

/** Soglie di default (SPEC.md §8). Usate come fallback e per popolare la riga "default" in DB. */
export const DEFAULT_RULE_SETTINGS: RuleSettingsData = {
  classificationConfidenceThreshold: 0.55,
  matchingAutoLinkConfidenceThreshold: 0.85,
  matchingPossibleDuplicateConfidenceThreshold: 0.5,
  deadlineCriticalWithinHours: 24,
  fineReducedDeadlineCriticalWithinHours: 48,
  claimAmountHighThreshold: 2000,
  quoteSameDayResponseWithinHours: 4,
  amountMismatchTolerancePercent: 5,
  enabledCategories: [],
  defaultDepartmentByCategory: null,
  emailRetentionDays: null,
  attachmentRetentionDays: null,
  auditLogRetentionDays: null,
  excludedSenderPatterns: [],
  appealGdpUnifiedContributionLowValue: 43,
  appealGdpUnifiedContributionHighValue: 98,
  appealGdpUnifiedContributionThreshold: 1100,
  appealGdpStampDutyAmount: 27,
  appealInternalHandlingCost: 80,
  appealLicensePointValueEquivalent: 50,
  appealFavorableMultiplier: 2.0,
  appealCostParamsSource: null,
  appealCostParamsVerifiedAt: null,
  visionExtractionDailyBudgetUsd: 5.0,
};
