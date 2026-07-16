import { prisma } from "@/lib/db/prisma";
import { PAGE_SIZE } from "@/lib/dashboard/constants";
import type { AuditAction } from "@/generated/prisma/enums";

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  createdAt: Date;
  actorName: string | null;
  caseId: string | null;
  caseReference: string | null;
}

/** "Registro attività" (FASE 3, tappa 6): a differenza della reference (mock, colonna
 * "Dettaglio" con frasi scritte a mano su 30 eventi fissi), qui gli eventi sono reali
 * (`AuditLog`, append-only — CLAUDE.md invariante 7) e cresce nel tempo, quindi paginato
 * come `/posta`/`/pratiche`. Nessuna colonna "Dettaglio": `metadata` è JSON strutturato
 * diverso per ognuna delle 21 azioni (from/to, fieldKey, ecc.), non testo libero pensato per
 * la visualizzazione — la stessa card per-pratica (`AuditLogCard.tsx`) non lo mostra già. */
export async function getAuditLogEntries(page = 1): Promise<{ items: AuditLogEntry[]; total: number }> {
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      include: { actor: { select: { name: true } }, case: { select: { id: true, reference: true } } },
      orderBy: { createdAt: "desc" },
      skip: (Math.max(1, page) - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count(),
  ]);

  return {
    items: logs.map((log) => ({
      id: log.id,
      action: log.action,
      createdAt: log.createdAt,
      actorName: log.actor?.name ?? null,
      caseId: log.case?.id ?? null,
      caseReference: log.case?.reference ?? null,
    })),
    total,
  };
}
