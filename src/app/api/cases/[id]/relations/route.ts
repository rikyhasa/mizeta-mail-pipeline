import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withPermission } from "@/lib/auth/route-helpers";
import { writeAuditLog } from "@/lib/pipeline/audit";

const postSchema = z.object({
  targetReference: z.string().min(1),
  kind: z.enum(["DUPLICATE_CANDIDATE", "RELATED"]),
});

/**
 * Collega manualmente questa pratica a un'altra (SPEC.md §10, azione "collega pratica"). Scelta
 * esplicita dell'utente: a differenza dei candidati proposti dalla pipeline (coda di revisione,
 * §7), qui la relazione nasce già confermata.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return withPermission("case:write", async (user) => {
    const { id: caseId } = await context.params;
    const parsed = postSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
    }

    const [sourceCase, targetCase] = await Promise.all([
      prisma.case.findUnique({ where: { id: caseId } }),
      prisma.case.findUnique({ where: { reference: parsed.data.targetReference } }),
    ]);
    if (!sourceCase) return Response.json({ error: "Pratica non trovata" }, { status: 404 });
    if (!targetCase) return Response.json({ error: "Pratica di destinazione non trovata (riferimento non valido)" }, { status: 404 });
    if (targetCase.id === caseId) return Response.json({ error: "Una pratica non può essere collegata a se stessa" }, { status: 400 });

    const now = new Date();
    const relation = await prisma.$transaction(async (tx) => {
      const created = await tx.caseRelation.upsert({
        where: { caseId_relatedCaseId_kind: { caseId, relatedCaseId: targetCase.id, kind: parsed.data.kind } },
        update: { status: "CONFIRMED", reviewedById: user.id, reviewedAt: now },
        create: {
          caseId,
          relatedCaseId: targetCase.id,
          kind: parsed.data.kind,
          status: "CONFIRMED",
          reason: "Collegamento manuale",
          reviewedById: user.id,
          reviewedAt: now,
        },
      });
      await writeAuditLog(tx, {
        action: "CASE_LINKED",
        entityType: "CaseRelation",
        entityId: created.id,
        caseId,
        actorId: user.id,
        metadata: { relatedCaseId: targetCase.id, kind: parsed.data.kind },
      });
      return created;
    });

    return Response.json({ relation }, { status: 201 });
  });
}
