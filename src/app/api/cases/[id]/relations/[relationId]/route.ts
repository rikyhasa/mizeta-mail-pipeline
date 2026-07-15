import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withPermission } from "@/lib/auth/route-helpers";
import { writeAuditLog } from "@/lib/pipeline/audit";

const patchSchema = z.object({ action: z.enum(["confirm", "reject"]) });

/** Conferma/rifiuta un candidato duplicato o correlato proposto dalla pipeline (SPEC.md §7, coda di revisione). */
export async function PATCH(request: Request, context: { params: Promise<{ id: string; relationId: string }> }) {
  return withPermission("case:write", async (user) => {
    const { id: caseId, relationId } = await context.params;
    const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
    }

    const relation = await prisma.caseRelation.findUnique({ where: { id: relationId } });
    if (!relation || relation.caseId !== caseId) {
      return Response.json({ error: "Relazione non trovata" }, { status: 404 });
    }

    const now = new Date();
    const status = parsed.data.action === "confirm" ? "CONFIRMED" : "REJECTED";
    const updated = await prisma.$transaction(async (tx) => {
      const updatedRelation = await tx.caseRelation.update({
        where: { id: relationId },
        data: { status, reviewedById: user.id, reviewedAt: now },
      });
      await writeAuditLog(tx, {
        action: parsed.data.action === "confirm" ? "CASE_LINKED" : "CASE_SPLIT",
        entityType: "CaseRelation",
        entityId: relationId,
        caseId,
        actorId: user.id,
        metadata: { relatedCaseId: relation.relatedCaseId, kind: relation.kind, decision: parsed.data.action },
      });
      return updatedRelation;
    });

    return Response.json({ relation: updated });
  });
}
