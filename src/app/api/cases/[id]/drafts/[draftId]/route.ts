import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withPermission } from "@/lib/auth/route-helpers";
import { writeAuditLog } from "@/lib/pipeline/audit";

const patchSchema = z.object({ action: z.enum(["approve", "discard"]) });

/**
 * Approva o scarta una bozza (SPEC.md §11, invariante 3): approvazione umana esplicita
 * obbligatoria. Nessuna di queste azioni invia l'email — l'invio non esiste nell'MVP
 * (CLAUDE.md invariante 2). Una bozza senza destinatario, oggetto, corpo, o con placeholder
 * non risolti non può risultare "Approvata" (docs/UX-AUDIT-2026-07.md, P0 #2).
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string; draftId: string }> }) {
  return withPermission("case:write", async (user) => {
    const { id: caseId, draftId } = await context.params;
    const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
    }

    const draft = await prisma.emailDraft.findUnique({ where: { id: draftId } });
    if (!draft || draft.caseId !== caseId) {
      return Response.json({ error: "Bozza non trovata" }, { status: 404 });
    }
    if (draft.status !== "PENDING_APPROVAL") {
      return Response.json({ error: "La bozza è già stata approvata o scartata" }, { status: 409 });
    }

    if (parsed.data.action === "approve") {
      const reasons: string[] = [];
      if (draft.toAddresses.length === 0) reasons.push("destinatario mancante");
      if (!draft.subject.trim()) reasons.push("oggetto mancante");
      if (!draft.bodyText.trim()) reasons.push("corpo mancante");
      if (draft.placeholders.length > 0) reasons.push("placeholder non risolti");
      if (reasons.length > 0) {
        return Response.json({ error: `Impossibile approvare: ${reasons.join(", ")}` }, { status: 422 });
      }
    }

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const updatedDraft = await tx.emailDraft.update({
        where: { id: draftId },
        data:
          parsed.data.action === "approve"
            ? { status: "APPROVED", approvedById: user.id, approvedAt: now }
            : { status: "DISCARDED" },
      });
      await writeAuditLog(tx, {
        action: parsed.data.action === "approve" ? "DRAFT_APPROVED" : "DRAFT_DISCARDED",
        entityType: "EmailDraft",
        entityId: draftId,
        caseId,
        actorId: user.id,
      });
      return updatedDraft;
    });

    return Response.json({ draft: updated });
  });
}
