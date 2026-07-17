import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { attachmentStorage } from "@/lib/storage/local-storage";
import { enqueueJob } from "@/lib/jobs/queue";
import { runWorkerOnce } from "@/lib/jobs/worker";
import { syncSpeedDeviceRegistryIdempotencyKey } from "@/lib/jobs/types";
import { recordManualSpeedRegistryUpload } from "@/lib/speed-registry/sync-speed-device-registry";

/**
 * Test end-to-end del sync registro MIT (docs/SPEC-AUTOVELOX-DRAFT.md §7bis, FASE E Tappa 5) via
 * il worker reale (mai chiamando direttamente il persist layer), stessa metodologia di
 * tests/integration/job-queue.test.ts: drena la coda prima di ogni test così l'unico job
 * PENDING rimasto è quello di questo test, ripulisce tutto dopo (righe Job/JobAttempt/
 * SpeedRegistrySnapshot/AuditLog e i file grezzi salvati in storage).
 *
 * Gira in modalità mock (`SPEED_REGISTRY_FETCHER=mock` di default, vedi .env.example): la stessa
 * fixture a 2 pagine/3 dispositivi viene restituita a ogni chiamata, quindi un secondo sync
 * produce sempre lo stesso hash — esercita naturalmente il percorso "nessuna modifica" senza
 * bisogno di manipolare lo stato.
 */
describe("Registro MIT — sync giornaliero e caricamento manuale", () => {
  const createdSnapshotIds: string[] = [];
  const createdStorageKeys: string[] = [];

  async function drainQueue(maxIterations = 100): Promise<void> {
    for (let i = 0; i < maxIterations; i += 1) {
      const { claimed } = await runWorkerOnce();
      if (!claimed) return;
    }
  }

  beforeEach(async () => {
    await drainQueue();
  });

  afterAll(async () => {
    await drainQueue();
    if (createdSnapshotIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { entityId: { in: createdSnapshotIds }, entityType: "SpeedRegistrySnapshot" } });
      await prisma.enforcementDeviceCheck.updateMany({ where: { registrySnapshotId: { in: createdSnapshotIds } }, data: { registrySnapshotId: null } });
      // diffFromPreviousId punta ad altri snapshot creati da questo stesso file: azzera prima di eliminare.
      await prisma.speedRegistrySnapshot.updateMany({ where: { id: { in: createdSnapshotIds } }, data: { diffFromPreviousId: null } });
      await prisma.speedRegistrySnapshot.deleteMany({ where: { id: { in: createdSnapshotIds } } });
    }
    for (const key of createdStorageKeys) {
      await attachmentStorage.delete(key);
    }
    await prisma.$disconnect();
  });

  it("esegue il sync schedulato, crea uno snapshot e si ri-accoda da solo a +24h", async () => {
    const before = Date.now();
    await enqueueJob({ type: "SYNC_SPEED_DEVICE_REGISTRY", payload: {}, idempotencyKey: syncSpeedDeviceRegistryIdempotencyKey() });

    const { claimed } = await runWorkerOnce();
    expect(claimed).toBe(true);

    const snapshot = await prisma.speedRegistrySnapshot.findFirst({ orderBy: { fetchedAt: "desc" } });
    expect(snapshot).not.toBeNull();
    expect(snapshot!.fetchMethod).toBe("SCHEDULED_FETCH");
    expect(snapshot!.deviceCount).toBe(3);
    createdSnapshotIds.push(snapshot!.id);
    createdStorageKeys.push(snapshot!.rawStorageKey);

    const audit = await prisma.auditLog.findFirst({ where: { action: "SPEED_REGISTRY_SYNCED", entityId: snapshot!.id } });
    expect(audit).toBeTruthy();

    const rescheduled = await prisma.job.findUnique({ where: { idempotencyKey: syncSpeedDeviceRegistryIdempotencyKey() } });
    expect(rescheduled).not.toBeNull();
    expect(rescheduled!.status).toBe("PENDING");
    expect(rescheduled!.nextRunAt.getTime()).toBeGreaterThan(before + 23 * 60 * 60 * 1000);

    await prisma.job.delete({ where: { id: rescheduled!.id } });
  });

  it("un secondo sync con lo stesso contenuto non crea uno snapshot duplicato (hash invariato)", async () => {
    await enqueueJob({ type: "SYNC_SPEED_DEVICE_REGISTRY", payload: {}, idempotencyKey: syncSpeedDeviceRegistryIdempotencyKey() });
    await runWorkerOnce();
    const firstSnapshot = await prisma.speedRegistrySnapshot.findFirstOrThrow({ orderBy: { fetchedAt: "desc" } });
    createdSnapshotIds.push(firstSnapshot.id);
    createdStorageKeys.push(firstSnapshot.rawStorageKey);
    const rescheduled1 = await prisma.job.findUniqueOrThrow({ where: { idempotencyKey: syncSpeedDeviceRegistryIdempotencyKey() } });
    await prisma.job.update({ where: { id: rescheduled1.id }, data: { nextRunAt: new Date() } });

    await runWorkerOnce();

    const snapshotsAfterSecondSync = await prisma.speedRegistrySnapshot.count();
    expect(snapshotsAfterSecondSync).toBe(1);

    const unchangedAudit = await prisma.auditLog.findFirst({
      where: { action: "SPEED_REGISTRY_SYNCED", entityId: firstSnapshot.id, metadata: { path: ["unchanged"], equals: true } },
    });
    expect(unchangedAudit).toBeTruthy();

    const rescheduled2 = await prisma.job.findUniqueOrThrow({ where: { idempotencyKey: syncSpeedDeviceRegistryIdempotencyKey() } });
    await prisma.job.delete({ where: { id: rescheduled2.id } });
  });

  it("il caricamento manuale crea uno snapshot MANUAL_UPLOAD con diff rispetto all'ultimo automatico", async () => {
    await enqueueJob({ type: "SYNC_SPEED_DEVICE_REGISTRY", payload: {}, idempotencyKey: syncSpeedDeviceRegistryIdempotencyKey() });
    await runWorkerOnce();
    const scheduledSnapshot = await prisma.speedRegistrySnapshot.findFirstOrThrow({ orderBy: { fetchedAt: "desc" } });
    createdSnapshotIds.push(scheduledSnapshot.id);
    createdStorageKeys.push(scheduledSnapshot.rawStorageKey);
    const rescheduled = await prisma.job.findUniqueOrThrow({ where: { idempotencyKey: syncSpeedDeviceRegistryIdempotencyKey() } });
    await prisma.job.delete({ where: { id: rescheduled.id } });

    const manualHtmlPage = `<html><body><table>
      <tr><th>Codice ente accertatore</th><th>Nome dispositivo</th><th>Codice catastale</th><th>Decreto normativo</th>
      <th>Data decreto</th><th>Tipo dispositivo</th><th>Produttore</th><th>Modello</th><th>Versione</th><th>Matricola</th>
      <th>Note</th><th>Data ultima comunicazione</th><th>Data primo inserimento</th></tr>
      <tr><td>COM99</td><td>Nuovo dispositivo caricato a mano</td><td>Z999</td><td>9/2026</td><td>01/01/2026</td>
      <td>Fisso</td><td>Sicve</td><td>1</td><td>1.0</td><td>MAN-001</td><td></td><td>01/07/2026</td><td>01/07/2026</td></tr>
    </table></body></html>`;

    const testUser = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    const result = await recordManualSpeedRegistryUpload({ pages: [manualHtmlPage], uploadedById: testUser.id });

    expect(result.unchanged).toBe(false);
    expect(result.deviceCount).toBe(1);
    expect(result.diff?.addedCount).toBe(1);
    expect(result.diff?.removedCount).toBe(3);

    const manualSnapshot = await prisma.speedRegistrySnapshot.findUniqueOrThrow({ where: { id: result.snapshotId! } });
    expect(manualSnapshot.fetchMethod).toBe("MANUAL_UPLOAD");
    expect(manualSnapshot.uploadedById).toBe(testUser.id);
    expect(manualSnapshot.diffFromPreviousId).toBe(scheduledSnapshot.id);
    createdSnapshotIds.push(manualSnapshot.id);
    createdStorageKeys.push(manualSnapshot.rawStorageKey);

    const manualAudit = await prisma.auditLog.findFirst({ where: { action: "SPEED_REGISTRY_MANUAL_UPLOAD", entityId: manualSnapshot.id } });
    expect(manualAudit).toBeTruthy();
    expect(manualAudit!.actorId).toBe(testUser.id);
  });
});
