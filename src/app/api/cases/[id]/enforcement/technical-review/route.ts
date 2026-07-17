import { prisma } from "@/lib/db/prisma";
import { withPermission } from "@/lib/auth/route-helpers";
import { writeAuditLog } from "@/lib/pipeline/audit";

/**
 * "Segna per verifica tecnica" (docs/SPEC-AUTOVELOX-DRAFT.md §8): permesso `enforcement:confirm`
 * (proposta primaria del brief — stessa cautela di "Conferma identificazione"/"Conferma dati",
 * non la cautela più stringente riservata alla verifica legale). Sposta lo stato sul bucket
 * generico "da verificare" già previsto dall'enum: nessun nuovo stato introdotto.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return withPermission("enforcement:confirm", async (user) => {
    const { id: caseId } = await context.params;

    const check = await prisma.enforcementDeviceCheck.findUnique({ where: { caseId } });
    if (!check) {
      return Response.json({ error: "Controllo dispositivo non trovato per questa pratica" }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.enforcementDeviceCheck.update({
        where: { caseId },
        data: { state: "TO_BE_VERIFIED", needsHumanReview: true },
      });

      await writeAuditLog(tx, {
        action: "ENFORCEMENT_TECHNICAL_REVIEW_REQUESTED",
        entityType: "EnforcementDeviceCheck",
        entityId: result.id,
        caseId,
        actorId: user.id,
        metadata: { from: check.state, to: "TO_BE_VERIFIED" },
      });

      return result;
    });

    return Response.json({ check: updated });
  });
}
