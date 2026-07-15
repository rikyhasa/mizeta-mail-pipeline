import { prisma } from "@/lib/db/prisma";
import { withPermission } from "@/lib/auth/route-helpers";
import { writeAuditLog } from "@/lib/pipeline/audit";

/** "Segna come verificata" (coda di revisione, SPEC.md §10): azzera needsHumanReview senza toccare stato/priorità. */
export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  return withPermission("case:write", async (user) => {
    const { id: caseId } = await context.params;
    const existing = await prisma.case.findUnique({ where: { id: caseId } });
    if (!existing) return Response.json({ error: "Pratica non trovata" }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      const updatedCase = await tx.case.update({ where: { id: caseId }, data: { needsHumanReview: false } });
      await writeAuditLog(tx, {
        action: "ADMIN_ACTION",
        entityType: "Case",
        entityId: caseId,
        caseId,
        actorId: user.id,
        metadata: { field: "needsHumanReview", action: "cleared" },
      });
      return updatedCase;
    });

    return Response.json({ case: updated });
  });
}
