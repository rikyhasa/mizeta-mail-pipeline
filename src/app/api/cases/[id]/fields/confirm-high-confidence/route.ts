import { prisma } from "@/lib/db/prisma";
import { withPermission } from "@/lib/auth/route-helpers";
import { writeAuditLog } from "@/lib/pipeline/audit";

/**
 * Conferma in blocco tutti i `CaseField` "ad alta confidenza" di una pratica (Troncone C, §2.1.B/
 * §2.2): stessa identica popolazione del tier `middle` già calcolato da `classifyFieldTier`
 * (valore presente, `needsHumanReview` già `false` dalla soglia 0.6 di `fieldFrom`, non ancora
 * confermato da un umano) — nessuna nuova soglia, nessuna nuova classificazione. Un solo click al
 * posto di N conferme individuali, ma stessa identica scrittura per campo (`confirmedById`,
 * `confirmedAt`, un audit `FIELD_CONFIRMED` ciascuno) della conferma singola — nessuna eccezione
 * al principio "audit log immutabile per le operazioni importanti", solo raggruppate in
 * un'unica richiesta/transazione.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return withPermission("case:write", async (user) => {
    const { id: caseId } = await context.params;

    const eligible = await prisma.caseField.findMany({
      where: { caseId, needsHumanReview: false, confirmedById: null, value: { not: null } },
      select: { id: true, fieldKey: true },
    });

    if (eligible.length === 0) {
      return Response.json({ confirmedCount: 0, fieldKeys: [] });
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      for (const field of eligible) {
        await tx.caseField.update({
          where: { id: field.id },
          data: { confirmedById: user.id, confirmedAt: now },
        });
        await writeAuditLog(tx, {
          action: "FIELD_CONFIRMED",
          entityType: "CaseField",
          entityId: field.id,
          caseId,
          actorId: user.id,
          metadata: { fieldKey: field.fieldKey, bulk: true },
        });
      }
    });

    return Response.json({ confirmedCount: eligible.length, fieldKeys: eligible.map((f) => f.fieldKey) });
  });
}
