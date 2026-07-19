import { prisma } from "@/lib/db/prisma";
import { withPermission } from "@/lib/auth/route-helpers";
import { writeAuditLog } from "@/lib/pipeline/audit";

/**
 * Conferma in blocco tutti gli `EnforcementDeviceField` "ad alta confidenza" di una pratica
 * (Troncone C, §2.1.B/§2.2) — stesso identico meccanismo del bulk-confirm generico
 * (`fields/confirm-high-confidence/route.ts`), solo su `EnforcementDeviceField` invece di
 * `CaseField` e con il permesso più stretto `enforcement:confirm`. I campi già azzerati
 * implicitamente dal confronto col registro MIT (`apply-registry-match.ts`, §2.1.A) non
 * compaiono qui come "da confermare" nell'UI (nessun bottone individuale su di loro), ma restano
 * comunque eleggibili a questo endpoint se qualcuno lo invoca — non fa differenza: sono già
 * `needsHumanReview: false`, confermarli esplicitamente aggiunge solo un `confirmedById` reale,
 * mai dannoso.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return withPermission("enforcement:confirm", async (user) => {
    const { id: caseId } = await context.params;

    const check = await prisma.enforcementDeviceCheck.findUnique({ where: { caseId } });
    if (!check) {
      return Response.json({ error: "Controllo dispositivo non trovato per questa pratica" }, { status: 404 });
    }

    const eligible = await prisma.enforcementDeviceField.findMany({
      where: { checkId: check.id, needsHumanReview: false, confirmedById: null, value: { not: null } },
      select: { id: true, fieldKey: true },
    });

    if (eligible.length === 0) {
      return Response.json({ confirmedCount: 0, fieldKeys: [] });
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      for (const field of eligible) {
        await tx.enforcementDeviceField.update({
          where: { id: field.id },
          data: { confirmedById: user.id, confirmedAt: now },
        });
        await writeAuditLog(tx, {
          action: "FIELD_CONFIRMED",
          entityType: "EnforcementDeviceField",
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
