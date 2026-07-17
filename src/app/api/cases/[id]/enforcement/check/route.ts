import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withPermission } from "@/lib/auth/route-helpers";
import { writeAuditLog } from "@/lib/pipeline/audit";
import { ENFORCEMENT_CHECK_APPLICABILITY_LABELS } from "@/lib/i18n/labels";
import type { EnforcementCheckApplicability, EnforcementVerificationState } from "@/generated/prisma/enums";

const APPLICABILITY_VALUES = Object.keys(ENFORCEMENT_CHECK_APPLICABILITY_LABELS) as [
  EnforcementCheckApplicability,
  ...EnforcementCheckApplicability[],
];
const patchSchema = z.object({ applicability: z.enum(APPLICABILITY_VALUES).optional() });

/**
 * "Conferma identificazione" e "Correggi dispositivo" (docs/SPEC-AUTOVELOX-DRAFT.md §8) sono la
 * stessa operazione — senza `applicability`: conferma il valore esistente; con `applicability`:
 * lo corregge. Stesso pattern di PATCH /api/cases/[id]/fields/[fieldKey]. Richiede un
 * EnforcementDeviceCheck già esistente (creato dalla pipeline, Tappa 4): nessun percorso per
 * crearne uno manualmente in questa tappa.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return withPermission("enforcement:confirm", async (user) => {
    const { id: caseId } = await context.params;
    const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
    }

    const existing = await prisma.enforcementDeviceCheck.findUnique({ where: { caseId } });
    if (!existing) {
      return Response.json({ error: "Controllo dispositivo non trovato per questa pratica" }, { status: 404 });
    }

    const hasNewApplicability = parsed.data.applicability !== undefined;
    const applicability = hasNewApplicability ? parsed.data.applicability! : existing.applicability;

    // Non si può "confermare l'identificazione" di un dispositivo ancora da identificare (stesso
    // principio del P0 #1 di docs/UX-AUDIT-2026-07.md: mai confermare un dato ancora incompleto).
    if (applicability === "TO_BE_IDENTIFIED") {
      return Response.json(
        { error: "Impossibile confermare l'identificazione senza indicare il tipo di dispositivo" },
        { status: 422 },
      );
    }

    const state: EnforcementVerificationState = applicability === "NOT_APPLICABLE" ? "NOT_APPLICABLE" : "IDENTIFIED";

    const updated = await prisma.$transaction(async (tx) => {
      const check = await tx.enforcementDeviceCheck.update({
        where: { caseId },
        data: { applicability, state, confirmedById: user.id, confirmedAt: new Date(), needsHumanReview: false },
      });

      await writeAuditLog(tx, {
        action: "ENFORCEMENT_DEVICE_CONFIRMED",
        entityType: "EnforcementDeviceCheck",
        entityId: check.id,
        caseId,
        actorId: user.id,
        metadata: { from: existing.applicability, to: applicability },
      });

      return check;
    });

    return Response.json({ check: updated });
  });
}
