import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { getObservabilitySnapshot } from "@/lib/observability/metrics";

describe("getObservabilitySnapshot — correzioni manuali (SPEC.md §17)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("conta FIELD_UPDATED e FIELD_CONFIRMED della finestra 24h separatamente dagli eventi fuori finestra", async () => {
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    const someCase = await prisma.case.findFirstOrThrow();

    const now = new Date();
    const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);

    await prisma.auditLog.createMany({
      data: [
        { actorId: admin.id, action: "FIELD_UPDATED", entityType: "CaseField", caseId: someCase.id, createdAt: now },
        { actorId: admin.id, action: "FIELD_CONFIRMED", entityType: "CaseField", caseId: someCase.id, createdAt: now },
        { actorId: admin.id, action: "FIELD_CONFIRMED", entityType: "CaseField", caseId: someCase.id, createdAt: now },
        // Fuori dalla finestra 7 giorni: non deve essere conteggiato in nessuna delle due finestre.
        { actorId: admin.id, action: "FIELD_UPDATED", entityType: "CaseField", caseId: someCase.id, createdAt: eightDaysAgo },
        // Azione diversa: non deve essere conteggiata come correzione manuale.
        { actorId: admin.id, action: "STATUS_CHANGED", entityType: "Case", caseId: someCase.id, createdAt: now },
      ],
    });

    const snapshot = await getObservabilitySnapshot();

    expect(snapshot.manualCorrections.last24h.fieldsUpdated).toBeGreaterThanOrEqual(1);
    expect(snapshot.manualCorrections.last24h.fieldsConfirmed).toBeGreaterThanOrEqual(2);
    expect(snapshot.manualCorrections.last7d.fieldsUpdated).toBeGreaterThanOrEqual(snapshot.manualCorrections.last24h.fieldsUpdated);
  });
});
