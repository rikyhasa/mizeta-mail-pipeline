import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { getRuleSettings, invalidateRuleSettingsCache, updateRuleSettings } from "@/lib/rules/settings-repository";
import { DEFAULT_RULE_SETTINGS } from "@/lib/rules/default-settings";

describe("RuleSettings repository (SPEC.md §8, §16)", () => {
  afterAll(async () => {
    // Ripristina i default: la riga "default" è un singleton condiviso da tutta la pipeline.
    invalidateRuleSettingsCache();
    const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    await updateRuleSettings(DEFAULT_RULE_SETTINGS, admin?.id ?? "");
    await prisma.$disconnect();
  });

  it("crea la riga 'default' al primo accesso, senza bisogno di uno step di seed dedicato", async () => {
    invalidateRuleSettingsCache();
    const settings = await getRuleSettings();
    const row = await prisma.ruleSettings.findUnique({ where: { key: "default" } });
    expect(row).toBeTruthy();
    expect(settings.deadlineCriticalWithinHours).toBe(DEFAULT_RULE_SETTINGS.deadlineCriticalWithinHours);
  });

  it("updateRuleSettings applica la modifica e registra un AuditLog immutabile", async () => {
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    const updated = await updateRuleSettings({ claimAmountHighThreshold: 9999 }, admin.id);
    expect(updated.claimAmountHighThreshold).toBe(9999);

    const row = await prisma.ruleSettings.findUniqueOrThrow({ where: { key: "default" } });
    expect(Number(row.claimAmountHighThreshold)).toBe(9999);
    expect(row.updatedById).toBe(admin.id);

    const auditLog = await prisma.auditLog.findFirst({
      where: { action: "RULE_SETTINGS_UPDATED", entityId: row.id },
      orderBy: { createdAt: "desc" },
    });
    expect(auditLog).toBeTruthy();
    expect(auditLog?.actorId).toBe(admin.id);
  });

  it("invalidateRuleSettingsCache forza una nuova lettura da Postgres", async () => {
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    await updateRuleSettings({ amountMismatchTolerancePercent: 12 }, admin.id);
    invalidateRuleSettingsCache();
    const settings = await getRuleSettings();
    expect(settings.amountMismatchTolerancePercent).toBe(12);
  });
});
