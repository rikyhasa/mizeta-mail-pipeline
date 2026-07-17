import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withPermission } from "@/lib/auth/route-helpers";
import { writeAuditLog } from "@/lib/pipeline/audit";
import { CASE_STATUS_LABELS } from "@/lib/i18n/labels";
import { getCaseBlockers } from "@/lib/cases/blockers";
import type { CaseStatus } from "@/generated/prisma/enums";

const CASE_STATUS_VALUES = Object.keys(CASE_STATUS_LABELS) as [CaseStatus, ...CaseStatus[]];
const patchSchema = z.object({ status: z.enum(CASE_STATUS_VALUES) });

/**
 * Cambia lo stato di una pratica (usato sia dal selettore "Stato" in Sintesi operativa che da
 * "Segna completata" nel pannello Chiusura). Il passaggio a COMPLETED è rivalidato qui contro
 * gli stessi blocker mostrati in UI (docs/UX-AUDIT-2026-07.md, P0 #3): il bottone disabilitato
 * lato client non è mai l'unica barriera.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return withPermission("case:write", async (user) => {
    const { id: caseId } = await context.params;
    const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json({ error: "Stato non valido" }, { status: 400 });
    }

    const existing = await prisma.case.findUnique({ where: { id: caseId } });
    if (!existing) return Response.json({ error: "Pratica non trovata" }, { status: 404 });

    if (parsed.data.status === "COMPLETED") {
      const blockers = await getCaseBlockers(caseId);
      if (blockers.length > 0) {
        return Response.json(
          { error: `Impossibile completare: ${blockers.map((b) => b.text).join(" · ")}` },
          { status: 422 },
        );
      }
    }

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const updatedCase = await tx.case.update({
        where: { id: caseId },
        data: {
          status: parsed.data.status,
          completedAt: parsed.data.status === "COMPLETED" ? now : existing.completedAt,
          archivedAt: parsed.data.status === "ARCHIVED" ? now : existing.archivedAt,
        },
      });
      await writeAuditLog(tx, {
        action: "STATUS_CHANGED",
        entityType: "Case",
        entityId: caseId,
        caseId,
        actorId: user.id,
        metadata: { from: existing.status, to: parsed.data.status },
      });
      return updatedCase;
    });

    return Response.json({ case: updated });
  });
}
