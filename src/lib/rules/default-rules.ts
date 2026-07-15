import type { Rule } from "./types";
import { deadlineOverdueRule } from "./rules/deadline-overdue";
import { deadlineWithin24hRule } from "./rules/deadline-within-24h";
import { fineReducedDeadlineCriticalRule } from "./rules/fine-reduced-deadline-critical";
import { claimAmountHighRule } from "./rules/claim-amount-high";
import { quoteSameDayResponseRule } from "./rules/quote-same-day-response";
import { ibanMismatchRule } from "./rules/iban-mismatch";
import { possibleDuplicateRule } from "./rules/possible-duplicate";
import { lowConfidenceRule } from "./rules/low-confidence";
import { unreadableAttachmentRule } from "./rules/unreadable-attachment";
import { amountMismatchRule } from "./rules/amount-mismatch";

/** Le 10 regole di default (SPEC.md §8). */
export const DEFAULT_RULES: Rule[] = [
  deadlineOverdueRule,
  deadlineWithin24hRule,
  fineReducedDeadlineCriticalRule,
  claimAmountHighRule,
  quoteSameDayResponseRule,
  ibanMismatchRule,
  possibleDuplicateRule,
  lowConfidenceRule,
  unreadableAttachmentRule,
  amountMismatchRule,
];
