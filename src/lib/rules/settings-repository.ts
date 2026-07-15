import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { CASE_CATEGORY_LABELS, DEPARTMENT_LABELS } from "@/lib/i18n/labels";
import type { RuleSettingsData } from "./types";
import type { CaseCategory, Department } from "@/generated/prisma/enums";

const CASE_CATEGORY_VALUES = Object.keys(CASE_CATEGORY_LABELS) as [CaseCategory, ...CaseCategory[]];
const DEPARTMENT_VALUES = Object.keys(DEPARTMENT_LABELS) as [Department, ...Department[]];

export const ruleSettingsInputSchema = z.object({
  classificationConfidenceThreshold: z.number().min(0).max(1),
  matchingAutoLinkConfidenceThreshold: z.number().min(0).max(1),
  matchingPossibleDuplicateConfidenceThreshold: z.number().min(0).max(1),
  deadlineCriticalWithinHours: z.number().int().positive(),
  fineReducedDeadlineCriticalWithinHours: z.number().int().positive(),
  claimAmountHighThreshold: z.number().nonnegative(),
  quoteSameDayResponseWithinHours: z.number().int().positive(),
  amountMismatchTolerancePercent: z.number().nonnegative(),
  enabledCategories: z.array(z.enum(CASE_CATEGORY_VALUES)),
  defaultDepartmentByCategory: z.record(z.enum(CASE_CATEGORY_VALUES), z.enum(DEPARTMENT_VALUES)).nullable(),
  emailRetentionDays: z.number().int().positive().nullable(),
  attachmentRetentionDays: z.number().int().positive().nullable(),
  auditLogRetentionDays: z.number().int().positive().nullable(),
  excludedSenderPatterns: z.array(z.string()),
});

interface RuleSettingsRow {
  id: string;
  classificationConfidenceThreshold: number;
  matchingAutoLinkConfidenceThreshold: number;
  matchingPossibleDuplicateConfidenceThreshold: number;
  deadlineCriticalWithinHours: number;
  fineReducedDeadlineCriticalWithinHours: number;
  claimAmountHighThreshold: { toNumber(): number } | number;
  quoteSameDayResponseWithinHours: number;
  amountMismatchTolerancePercent: number;
  enabledCategories: CaseCategory[];
  defaultDepartmentByCategory: unknown;
  emailRetentionDays: number | null;
  attachmentRetentionDays: number | null;
  auditLogRetentionDays: number | null;
  excludedSenderPatterns: string[];
}

function toData(row: RuleSettingsRow): RuleSettingsData {
  return {
    classificationConfidenceThreshold: row.classificationConfidenceThreshold,
    matchingAutoLinkConfidenceThreshold: row.matchingAutoLinkConfidenceThreshold,
    matchingPossibleDuplicateConfidenceThreshold: row.matchingPossibleDuplicateConfidenceThreshold,
    deadlineCriticalWithinHours: row.deadlineCriticalWithinHours,
    fineReducedDeadlineCriticalWithinHours: row.fineReducedDeadlineCriticalWithinHours,
    claimAmountHighThreshold: typeof row.claimAmountHighThreshold === "number" ? row.claimAmountHighThreshold : row.claimAmountHighThreshold.toNumber(),
    quoteSameDayResponseWithinHours: row.quoteSameDayResponseWithinHours,
    amountMismatchTolerancePercent: row.amountMismatchTolerancePercent,
    enabledCategories: row.enabledCategories,
    defaultDepartmentByCategory: (row.defaultDepartmentByCategory as Partial<Record<CaseCategory, Department>> | null) ?? null,
    emailRetentionDays: row.emailRetentionDays,
    attachmentRetentionDays: row.attachmentRetentionDays,
    auditLogRetentionDays: row.auditLogRetentionDays,
    excludedSenderPatterns: row.excludedSenderPatterns,
  };
}

let cache: RuleSettingsData | null = null;

/**
 * Legge le soglie configurabili (SPEC.md §8, §16). La riga "default" viene creata al primo
 * accesso (upsert) se non esiste ancora: nessuno step di seed dedicato necessario, la
 * configurabilità è persistita fin da questa fase anche se la UI di modifica arriva in Fase 3.
 */
export async function getRuleSettings(): Promise<RuleSettingsData> {
  if (cache) return cache;
  const row = await prisma.ruleSettings.upsert({
    where: { key: "default" },
    update: {},
    create: { key: "default" },
  });
  cache = toData(row);
  return cache;
}

export function invalidateRuleSettingsCache(): void {
  cache = null;
}

export async function updateRuleSettings(patch: Partial<RuleSettingsData>, updatedById: string): Promise<RuleSettingsData> {
  const parsed = ruleSettingsInputSchema.partial().parse(patch);
  // Il campo Json nullable di Prisma richiede il sentinel Prisma.JsonNull per rappresentare
  // esplicitamente `null` in create/update — un `null` letterale non è un InputJsonValue valido.
  const data = {
    ...parsed,
    defaultDepartmentByCategory:
      parsed.defaultDepartmentByCategory === null
        ? Prisma.JsonNull
        : (parsed.defaultDepartmentByCategory as Prisma.InputJsonValue | undefined),
    updatedById,
  };
  const updated = await prisma.ruleSettings.upsert({
    where: { key: "default" },
    create: { key: "default", ...data },
    update: data,
  });

  await prisma.auditLog.create({
    data: {
      actorId: updatedById,
      action: "RULE_SETTINGS_UPDATED",
      entityType: "RuleSettings",
      entityId: updated.id,
      metadata: parsed,
    },
  });

  invalidateRuleSettingsCache();
  return toData(updated);
}
