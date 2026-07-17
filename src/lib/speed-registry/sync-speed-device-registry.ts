import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { SpeedRegistryFetchMethod } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { attachmentStorage } from "@/lib/storage/local-storage";
import { writeAuditLog } from "@/lib/pipeline/audit";
import { getCachedSpeedRegistryFetcher } from "@/lib/adapters/speed-registry/speed-registry-fetcher-factory";
import { SPEED_REGISTRY_SOURCE_URL } from "@/lib/adapters/speed-registry/real-fetcher";
import { parseSpeedRegistryHtml } from "./parse-devices-html";
import { diffDeviceLists } from "./diff-devices";
import type { SpeedRegistryDeviceRow, SpeedRegistrySyncResult } from "./types";

/** Separatore fra pagine nel file grezzo salvato in storage: improbabile in HTML reale, permette
 * di ricostruire l'array di pagine originale quando si rilegge uno snapshot precedente per il diff. */
const PAGE_BREAK_MARKER = "\n<!--MIZETA_SPEED_REGISTRY_PAGE_BREAK-->\n";

function hashPages(pages: string[]): string {
  return createHash("sha256").update(pages.join(PAGE_BREAK_MARKER)).digest("hex");
}

async function loadPreviousDevices(rawStorageKey: string): Promise<SpeedRegistryDeviceRow[]> {
  const raw = (await attachmentStorage.get(rawStorageKey)).toString("utf-8");
  const pages = raw.split(PAGE_BREAK_MARKER);
  return parseSpeedRegistryHtml(pages).devices;
}

interface PersistParams {
  pages: string[];
  fetchMethod: SpeedRegistryFetchMethod;
  uploadedById?: string;
}

/**
 * Logica condivisa fra sync giornaliero e caricamento manuale (docs/SPEC-AUTOVELOX-DRAFT.md
 * §7bis): parsing deterministico, calcolo hash, diff rispetto all'ultimo snapshot, persistenza.
 * Se l'hash è identico all'ultimo snapshot, non ne crea uno duplicato — registra solo un audit
 * "nessuna modifica" (decisione presa in Tappa 5: evitare uno snapshot al giorno quando il
 * registro non cambia, il caso più comune vista l'assenza di una cadenza di aggiornamento nota).
 */
async function persistSpeedRegistrySnapshot(params: PersistParams): Promise<SpeedRegistrySyncResult> {
  const { pages, fetchMethod, uploadedById } = params;
  const { devices, malformedRowCount } = parseSpeedRegistryHtml(pages);
  const payloadHash = hashPages(pages);

  const previous = await prisma.speedRegistrySnapshot.findFirst({ orderBy: { fetchedAt: "desc" } });

  if (previous && previous.payloadHash === payloadHash) {
    await prisma.$transaction(async (tx) => {
      await writeAuditLog(tx, {
        action: "SPEED_REGISTRY_SYNCED",
        entityType: "SpeedRegistrySnapshot",
        entityId: previous.id,
        actorId: uploadedById,
        metadata: {
          sourceUrl: SPEED_REGISTRY_SOURCE_URL,
          fetchMethod,
          unchanged: true,
          deviceCount: devices.length,
          malformedRowCount,
        },
      });
    });
    return { snapshotId: null, unchanged: true, deviceCount: devices.length, malformedRowCount, diff: null };
  }

  const previousDevices = previous ? await loadPreviousDevices(previous.rawStorageKey) : [];
  const diff = diffDeviceLists(previousDevices, devices);

  const rawStorageKey = `speed-registry/${randomUUID()}.html`;
  await attachmentStorage.put(rawStorageKey, pages.join(PAGE_BREAK_MARKER));

  const snapshot = await prisma.$transaction(async (tx) => {
    const created = await tx.speedRegistrySnapshot.create({
      data: {
        sourceUrl: SPEED_REGISTRY_SOURCE_URL,
        fetchMethod,
        uploadedById,
        payloadHash,
        deviceCount: devices.length,
        rawStorageKey,
        diffFromPreviousId: previous?.id,
        diffSummary: diff as unknown as Prisma.InputJsonValue,
      },
    });
    await writeAuditLog(tx, {
      action: fetchMethod === "MANUAL_UPLOAD" ? "SPEED_REGISTRY_MANUAL_UPLOAD" : "SPEED_REGISTRY_SYNCED",
      entityType: "SpeedRegistrySnapshot",
      entityId: created.id,
      actorId: uploadedById,
      metadata: {
        sourceUrl: SPEED_REGISTRY_SOURCE_URL,
        fetchMethod,
        deviceCount: devices.length,
        malformedRowCount,
        addedCount: diff.addedCount,
        removedCount: diff.removedCount,
        changedCount: diff.changedCount,
      },
    });
    return created;
  });

  return { snapshotId: snapshot.id, unchanged: false, deviceCount: devices.length, malformedRowCount, diff };
}

/** Job schedulato SYNC_SPEED_DEVICE_REGISTRY (docs/SPEC-AUTOVELOX-DRAFT.md §7bis): nessuna
 * chiamata LLM, solo fetch + parsing deterministico. */
export async function runScheduledSpeedRegistrySync(): Promise<SpeedRegistrySyncResult> {
  const fetcher = getCachedSpeedRegistryFetcher();
  const pages = await fetcher.fetchDevicePages();
  return persistSpeedRegistrySnapshot({ pages, fetchMethod: "SCHEDULED_FETCH" });
}

/** Fallback manuale (docs/SPEC-AUTOVELOX-DRAFT.md §7bis): stesso parsing/diff/persistenza del
 * sync schedulato, solo l'origine cambia. Nessuna verifica automatica di correttezza del
 * contenuto oltre al parsing di formato: la responsabilità del contenuto resta dell'operatore
 * ADMIN che carica il file. */
export async function recordManualSpeedRegistryUpload(params: { pages: string[]; uploadedById: string }): Promise<SpeedRegistrySyncResult> {
  return persistSpeedRegistrySnapshot({ pages: params.pages, fetchMethod: "MANUAL_UPLOAD", uploadedById: params.uploadedById });
}
