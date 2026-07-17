import { prisma } from "@/lib/db/prisma";
import { withPermission } from "@/lib/auth/route-helpers";
import { writeAuditLog } from "@/lib/pipeline/audit";

/**
 * "Segna per verifica legale" (docs/SPEC-AUTOVELOX-DRAFT.md §8/§9): solo ADMIN
 * (`enforcement:legal-escalate`) — un'escalation errata avrebbe conseguenze più delicate di una
 * semplice conferma dati, stessa cautela già motivata nella tabella permessi del §9.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return withPermission("enforcement:legal-escalate", async (user) => {
    const { id: caseId } = await context.params;

    const check = await prisma.enforcementDeviceCheck.findUnique({ where: { caseId } });
    if (!check) {
      return Response.json({ error: "Controllo dispositivo non trovato per questa pratica" }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.enforcementDeviceCheck.update({
        where: { caseId },
        data: { state: "REQUIRES_LEGAL_REVIEW", needsLegalReview: true },
      });

      await writeAuditLog(tx, {
        action: "ENFORCEMENT_LEGAL_ESCALATED",
        entityType: "EnforcementDeviceCheck",
        entityId: result.id,
        caseId,
        actorId: user.id,
        metadata: { from: check.state, to: "REQUIRES_LEGAL_REVIEW" },
      });

      return result;
    });

    return Response.json({ check: updated });
  });
}
