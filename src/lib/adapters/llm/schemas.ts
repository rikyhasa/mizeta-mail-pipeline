import { z } from "zod";
import { CASE_CATEGORY_LABELS } from "@/lib/i18n/labels";
import type { CaseCategory, CasePriority, Department } from "@/generated/prisma/enums";

const CASE_CATEGORY_VALUES = Object.keys(CASE_CATEGORY_LABELS) as [CaseCategory, ...CaseCategory[]];

const CASE_PRIORITY_VALUES: [CasePriority, ...CasePriority[]] = [
  "CRITICAL",
  "HIGH",
  "NORMAL",
  "LOW",
];

const DEPARTMENT_VALUES: [Department, ...Department[]] = [
  "OPERATIONS",
  "ACCOUNTING",
  "COMMERCIAL",
  "MANAGEMENT",
];

/**
 * Structured Output schema for the classification pipeline step (SPEC.md §6, minimum shape).
 * Enums are allowlist-only; the model can never introduce a new enum value.
 */
export const classificationResultSchema = z.object({
  primary_category: z.enum(CASE_CATEGORY_VALUES),
  secondary_categories: z.array(z.enum(CASE_CATEGORY_VALUES)),
  short_title: z.string().min(1),
  summary: z.string().min(1),
  action_required: z.boolean(),
  suggested_actions: z.array(z.string()),
  priority: z.enum(CASE_PRIORITY_VALUES),
  priority_reasons: z.array(z.string()),
  deadline: z.string().nullable(),
  responsible_department: z.enum(DEPARTMENT_VALUES).nullable(),
  customer_or_supplier: z.string().nullable(),
  related_business_identifiers: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  needs_human_review: z.boolean(),
  security_flags: z.array(z.string()),
});

export type ClassificationResult = z.infer<typeof classificationResultSchema>;
