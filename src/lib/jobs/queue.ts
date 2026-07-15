import type { Prisma } from "@/generated/prisma/client";
import type { JobType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/config/env";

export interface EnqueueJobParams {
  type: JobType;
  payload: Prisma.InputJsonValue;
  idempotencyKey: string;
  runAt?: Date;
}

/**
 * Job queue su Postgres (SPEC.md §3/§17: retry, backoff, dead-letter — "o simile" di
 * CLAUDE.md, nessuna nuova infrastruttura Redis). `idempotencyKey` è la chiave di dedup: se
 * esiste già un job PENDING/RUNNING con la stessa chiave, l'enqueue è un no-op (una raffica di
 * webhook per la stessa mailbox si accorpa in un solo sync); se il job precedente è già in uno
 * stato terminale (SUCCEEDED/DEAD_LETTER), viene riarmato da zero.
 */
export async function enqueueJob(params: EnqueueJobParams): Promise<{ jobId: string; created: boolean }> {
  const { type, payload, idempotencyKey, runAt } = params;
  return prisma.$transaction(async (tx) => {
    const existing = await tx.job.findUnique({ where: { idempotencyKey } });
    if (!existing) {
      const created = await tx.job.create({
        data: {
          type,
          payload,
          idempotencyKey,
          nextRunAt: runAt ?? new Date(),
          maxAttempts: env.JOB_MAX_ATTEMPTS,
        },
      });
      return { jobId: created.id, created: true };
    }
    if (existing.status === "PENDING" || existing.status === "RUNNING") {
      return { jobId: existing.id, created: false };
    }
    const updated = await tx.job.update({
      where: { id: existing.id },
      data: {
        status: "PENDING",
        attempts: 0,
        nextRunAt: runAt ?? new Date(),
        lastError: null,
        payload,
      },
    });
    return { jobId: updated.id, created: false };
  });
}
