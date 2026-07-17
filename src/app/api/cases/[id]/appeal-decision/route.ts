import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withPermission } from "@/lib/auth/route-helpers";
import { writeAuditLog } from "@/lib/pipeline/audit";
import { APPEAL_DECISION_LABELS } from "@/lib/i18n/labels";
import type { AppealDecisionKind } from "@/generated/prisma/enums";

const DECISION_VALUES = Object.keys(APPEAL_DECISION_LABELS) as [AppealDecisionKind, ...AppealDecisionKind[]];
const patchSchema = z.object({ decision: z.enum(DECISION_VALUES), note: z.string().nullable().optional() });

/**
 * Registra la decisione dell'operatore sull'indicatore ricorso (docs/SPEC.md §10bis,
 * docs/SPEC-AUTOVELOX-DRAFT.md §15.6): solo la decisione è persistita, mai il calcolo
 * dell'indicatore stesso (ricalcolato a lettura). Permesso `case:write` — non
 * `enforcement:*`, che è specifico al modulo di verifica autovelox: l'indicatore ricorso si
 * applica a tutte le multe, non solo a quelle con quel modulo (§15.8).
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return withPermission("case:write", async (user) => {
    const { id: caseId } = await context.params;
    const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
    }

    const existingCase = await prisma.case.findUnique({ where: { id: caseId } });
    if (!existingCase) {
      return Response.json({ error: "Pratica non trovata" }, { status: 404 });
    }

    const existingDecision = await prisma.appealDecision.findUnique({ where: { caseId } });
    const now = new Date();
    const note = parsed.data.note?.trim() || null;

    const updated = await prisma.$transaction(async (tx) => {
      const decision = await tx.appealDecision.upsert({
        where: { caseId },
        create: { caseId, decision: parsed.data.decision, note, decidedById: user.id, decidedAt: now },
        update: { decision: parsed.data.decision, note, decidedById: user.id, decidedAt: now },
      });

      await writeAuditLog(tx, {
        action: "APPEAL_DECISION_RECORDED",
        entityType: "AppealDecision",
        entityId: decision.id,
        caseId,
        actorId: user.id,
        metadata: { from: existingDecision?.decision ?? "NOT_DECIDED", to: parsed.data.decision, note },
      });

      return decision;
    });

    return Response.json({ appealDecision: updated });
  });
}
