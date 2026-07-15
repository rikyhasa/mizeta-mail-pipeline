import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withPermission } from "@/lib/auth/route-helpers";
import { writeAuditLog } from "@/lib/pipeline/audit";

const patchSchema = z.object({ assignedToId: z.string().nullable() });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return withPermission("case:write", async (user) => {
    const { id: caseId } = await context.params;
    const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
    }

    const existing = await prisma.case.findUnique({ where: { id: caseId } });
    if (!existing) return Response.json({ error: "Pratica non trovata" }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      const updatedCase = await tx.case.update({ where: { id: caseId }, data: { assignedToId: parsed.data.assignedToId } });
      await writeAuditLog(tx, {
        action: "ASSIGNEE_CHANGED",
        entityType: "Case",
        entityId: caseId,
        caseId,
        actorId: user.id,
        metadata: { from: existing.assignedToId, to: parsed.data.assignedToId },
      });
      return updatedCase;
    });

    return Response.json({ case: updated });
  });
}
