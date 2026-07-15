import type { Prisma } from "@/generated/prisma/client";
import type { AuditAction } from "@/generated/prisma/enums";

/** Helper tipizzato per l'audit log immutabile (CLAUDE.md invariante 7): mai segreti o corpo email. */
export async function writeAuditLog(
  tx: Prisma.TransactionClient,
  entry: {
    action: AuditAction;
    entityType: string;
    entityId?: string;
    caseId?: string;
    actorId?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      caseId: entry.caseId,
      actorId: entry.actorId,
      metadata: entry.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}
