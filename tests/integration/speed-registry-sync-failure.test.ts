import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * Forza un fallimento del parsing (portale irraggiungibile o formato tabella cambiato,
 * docs/SPEC-AUTOVELOX-DRAFT.md §7bis): il fetcher mockato restituisce HTML senza alcuna tabella
 * valida, `parseSpeedRegistryHtml` lancia, il job va in DEAD_LETTER — e comunque si ri-accoda a
 * +24h (l'auto-rischedulazione avviene anche dopo l'esaurimento dei tentativi, non solo dopo un
 * successo, per non perdere il ciclo giornaliero successivo). Stesso pattern di
 * tests/integration/pipeline-extraction-error.test.ts (vi.mock del modulo factory).
 */
vi.mock("@/lib/adapters/speed-registry/speed-registry-fetcher-factory", () => {
  const brokenFetcher = {
    async fetchDevicePages() {
      return ["<html><body><p>Il portale non è più raggiungibile.</p></body></html>"];
    },
  };
  return {
    getCachedSpeedRegistryFetcher: () => brokenFetcher,
    getSpeedRegistryFetcher: () => brokenFetcher,
    resetCachedSpeedRegistryFetcher: () => {},
  };
});

import { prisma } from "@/lib/db/prisma";
import { runWorkerOnce } from "@/lib/jobs/worker";
import { syncSpeedDeviceRegistryIdempotencyKey } from "@/lib/jobs/types";

describe("Registro MIT — fallback su parsing fallito", () => {
  async function drainQueue(maxIterations = 100): Promise<void> {
    for (let i = 0; i < maxIterations; i += 1) {
      const { claimed } = await runWorkerOnce();
      if (!claimed) return;
    }
  }

  afterAll(async () => {
    await drainQueue();
    await prisma.$disconnect();
  });

  it("va in DEAD_LETTER quando il parsing fallisce, e si ri-accoda comunque a +24h", async () => {
    await drainQueue();

    const job = await prisma.job.create({
      data: {
        type: "SYNC_SPEED_DEVICE_REGISTRY",
        payload: {},
        idempotencyKey: syncSpeedDeviceRegistryIdempotencyKey(),
        maxAttempts: 1,
      },
    });

    const before = Date.now();
    const { claimed, jobId } = await runWorkerOnce();
    expect(claimed).toBe(true);
    expect(jobId).toBe(job.id);

    // Il tentativo fallito viene registrato come FAILED e l'audit JOB_DEAD_LETTERED viene
    // scritto (src/lib/jobs/worker.ts markFailed) PRIMA che l'auto-rischedulazione riarmi la
    // riga: entrambi i fatti restano storicamente veri anche se la riga Job stessa torna PENDING
    // nello stesso giro (vedi sotto) — non c'è modo di osservare uno stato DEAD_LETTER persistito
    // per un job che si auto-rischedula, per design.
    const attempt = await prisma.jobAttempt.findFirstOrThrow({ where: { jobId: job.id } });
    expect(attempt.status).toBe("FAILED");

    const deadLetterAudit = await prisma.auditLog.findFirst({ where: { action: "JOB_DEAD_LETTERED", entityId: job.id } });
    expect(deadLetterAudit).toBeTruthy();

    // `enqueueJob` riarma da zero la STESSA riga (stessa idempotencyKey), non ne crea una seconda
    // (src/lib/jobs/queue.ts): la riga finisce PENDING a +24h, non resta DEAD_LETTER.
    const rescheduled = await prisma.job.findUniqueOrThrow({ where: { idempotencyKey: syncSpeedDeviceRegistryIdempotencyKey() } });
    expect(rescheduled.id).toBe(job.id);
    expect(rescheduled.status).toBe("PENDING");
    expect(rescheduled.nextRunAt.getTime()).toBeGreaterThan(before + 23 * 60 * 60 * 1000);
    expect(rescheduled.attempts).toBe(0);

    await prisma.auditLog.deleteMany({ where: { action: "JOB_DEAD_LETTERED", entityId: job.id } });
    await prisma.jobAttempt.deleteMany({ where: { jobId: job.id } });
    await prisma.job.delete({ where: { id: job.id } });

    const snapshot = await prisma.speedRegistrySnapshot.findFirst();
    expect(snapshot).toBeNull();
  });
});
