import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withPermission } from "@/lib/auth/route-helpers";
import { writeAuditLog } from "@/lib/pipeline/audit";

const patchSchema = z.object({
  value: z.string().nullable().optional(),
});

/**
 * Conferma o correggi un campo estratto (SPEC.md §10). Senza `value`: conferma il valore
 * esistente così com'è. Con `value`: lo corregge — in entrambi i casi il campo è considerato
 * verificato da un umano e `needsHumanReview` si azzera. Un campo senza alcun valore (né
 * esistente né fornito nella richiesta) non può risultare "confermato" (docs/UX-AUDIT-2026-07.md,
 * P0 #1) — va prima valorizzato.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string; fieldKey: string }> }) {
  return withPermission("case:write", async (user) => {
    const { id: caseId, fieldKey } = await context.params;
    const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
    }

    const existing = await prisma.caseField.findUnique({ where: { caseId_fieldKey: { caseId, fieldKey } } });
    if (!existing) {
      return Response.json({ error: "Campo non trovato" }, { status: 404 });
    }

    const hasNewValue = parsed.data.value !== undefined;
    const effectiveValue = hasNewValue ? parsed.data.value : existing.value;
    if (!effectiveValue?.trim()) {
      return Response.json(
        { error: "Impossibile confermare un campo senza valore: inserire prima un valore" },
        { status: 422 },
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const field = await tx.caseField.update({
        where: { caseId_fieldKey: { caseId, fieldKey } },
        data: {
          ...(hasNewValue ? { value: parsed.data.value } : {}),
          confirmedById: user.id,
          confirmedAt: new Date(),
          needsHumanReview: false,
        },
      });

      await writeAuditLog(tx, {
        action: hasNewValue ? "FIELD_UPDATED" : "FIELD_CONFIRMED",
        entityType: "CaseField",
        entityId: field.id,
        caseId,
        actorId: user.id,
        metadata: { fieldKey, ...(hasNewValue ? { newValue: parsed.data.value } : {}) },
      });

      return field;
    });

    return Response.json({ field: updated });
  });
}
