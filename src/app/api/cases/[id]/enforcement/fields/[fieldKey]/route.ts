import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withPermission } from "@/lib/auth/route-helpers";
import { writeAuditLog } from "@/lib/pipeline/audit";
import { matchAndPersistDeviceRegistryMatch } from "@/lib/speed-registry/apply-registry-match";

/** Campi la cui conferma può cambiare l'esito del confronto col registro MIT — solo la matricola
 * è pensata per essere un identificativo univoco per dispositivo fisico (numero decreto come
 * fallback nel matcher stesso). Confermare un produttore o un modello da solo non basta a
 * cercare nel registro (docs/SPEC-AUTOVELOX-DRAFT.md §7bis). */
const FIELDS_TRIGGERING_REGISTRY_MATCH = new Set(["serial_number", "decree_number"]);

const patchSchema = z.object({ value: z.string().nullable().optional() });

/**
 * "Conferma dati" (docs/SPEC-AUTOVELOX-DRAFT.md §8): stesso pattern esatto di
 * PATCH /api/cases/[id]/fields/[fieldKey] (incluso il rifiuto di confermare un campo senza
 * valore, P0 #1 di docs/UX-AUDIT-2026-07.md), applicato a EnforcementDeviceField invece di
 * CaseField.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string; fieldKey: string }> }) {
  return withPermission("enforcement:confirm", async (user) => {
    const { id: caseId, fieldKey } = await context.params;
    const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
    }

    const check = await prisma.enforcementDeviceCheck.findUnique({ where: { caseId } });
    if (!check) {
      return Response.json({ error: "Controllo dispositivo non trovato per questa pratica" }, { status: 404 });
    }

    const existing = await prisma.enforcementDeviceField.findUnique({ where: { checkId_fieldKey: { checkId: check.id, fieldKey } } });
    if (!existing) {
      return Response.json({ error: "Campo non trovato" }, { status: 404 });
    }

    const hasNewValue = parsed.data.value !== undefined;
    const effectiveValue = hasNewValue ? parsed.data.value : existing.value;
    if (!effectiveValue?.trim()) {
      return Response.json({ error: "Impossibile confermare un campo senza valore: inserire prima un valore" }, { status: 422 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const field = await tx.enforcementDeviceField.update({
        where: { checkId_fieldKey: { checkId: check.id, fieldKey } },
        data: {
          ...(hasNewValue ? { value: parsed.data.value } : {}),
          confirmedById: user.id,
          confirmedAt: new Date(),
          needsHumanReview: false,
        },
      });

      await writeAuditLog(tx, {
        action: hasNewValue ? "FIELD_UPDATED" : "FIELD_CONFIRMED",
        entityType: "EnforcementDeviceField",
        entityId: field.id,
        caseId,
        actorId: user.id,
        metadata: { fieldKey, ...(hasNewValue ? { newValue: parsed.data.value } : {}) },
      });

      return field;
    });

    if (FIELDS_TRIGGERING_REGISTRY_MATCH.has(fieldKey)) {
      await matchAndPersistDeviceRegistryMatch(caseId, user.id);
    }

    return Response.json({ field: updated });
  });
}
