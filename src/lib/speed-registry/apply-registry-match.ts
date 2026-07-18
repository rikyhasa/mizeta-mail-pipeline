import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/pipeline/audit";
import type { EnforcementCheckApplicability, EnforcementRegistryMatchState } from "@/generated/prisma/enums";
import { matchDeviceAgainstRegistry, type DeviceIdentityForMatch } from "./match-device-registry";
import { loadDevicesFromSnapshot } from "./sync-speed-device-registry";

/** Applicabilità per cui ha senso cercare un dispositivo concreto nel registro — esclude
 * TO_BE_IDENTIFIED (nulla da cercare) e NOT_APPLICABLE (nessun EnforcementDeviceCheck esiste
 * comunque in quel caso). */
const APPLICABILITY_ELIGIBLE_FOR_MATCH: EnforcementCheckApplicability[] = [
  "SPEED_CAMERA_FIXED",
  "SPEED_CAMERA_MOBILE",
  "AVERAGE_SPEED_CONTROL",
  "TELELASER",
  "OTHER_SPEED_DEVICE",
];

async function loadDeviceIdentity(checkId: string): Promise<DeviceIdentityForMatch> {
  const fields = await prisma.enforcementDeviceField.findMany({
    where: { checkId, fieldKey: { in: ["manufacturer", "model", "serial_number", "decree_number"] } },
    select: { fieldKey: true, value: true },
  });
  const byKey = new Map(fields.map((f) => [f.fieldKey, f.value]));
  return {
    manufacturer: byKey.get("manufacturer") ?? null,
    model: byKey.get("model") ?? null,
    serialNumber: byKey.get("serial_number") ?? null,
    decreeNumber: byKey.get("decree_number") ?? null,
  };
}

async function persistMatch(
  checkId: string,
  caseId: string,
  snapshotId: string,
  match: EnforcementRegistryMatchState,
  actorId: string | null,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.enforcementDeviceCheck.update({
      where: { id: checkId },
      data: { registryMatch: match, registrySnapshotId: snapshotId },
    });
    await writeAuditLog(tx, {
      action: "ENFORCEMENT_REGISTRY_MATCHED",
      entityType: "EnforcementDeviceCheck",
      entityId: checkId,
      caseId,
      actorId: actorId ?? undefined,
      metadata: { match, snapshotId },
    });
  });
}

/**
 * Confronta il dispositivo di una pratica col registro MIT più recente
 * (docs/SPEC-AUTOVELOX-DRAFT.md §7bis/§15.3) e scrive l'esito su `EnforcementDeviceCheck` —
 * chiamato alla conferma dell'identificazione e alla conferma della matricola. Nessuna scrittura
 * se l'applicabilità non è un dispositivo concreto, se mancano sia matricola sia numero decreto,
 * o se nessuno snapshot del registro esiste ancora: in quel caso il registro resta "non
 * consultato" (`registryMatch` rimane `null`), correttamente — mai un `NOT_FOUND` inventato per
 * assenza di dati da confrontare.
 */
export async function matchAndPersistDeviceRegistryMatch(
  caseId: string,
  actorId: string | null,
): Promise<{ match: EnforcementRegistryMatchState | null }> {
  const check = await prisma.enforcementDeviceCheck.findUnique({ where: { caseId } });
  if (!check || !APPLICABILITY_ELIGIBLE_FOR_MATCH.includes(check.applicability)) return { match: null };

  const snapshot = await prisma.speedRegistrySnapshot.findFirst({ orderBy: { fetchedAt: "desc" } });
  if (!snapshot) return { match: null };

  const identity = await loadDeviceIdentity(check.id);
  const registryDevices = await loadDevicesFromSnapshot(snapshot.rawStorageKey);
  const { match } = matchDeviceAgainstRegistry(identity, registryDevices);
  if (match === null) return { match: null };

  await persistMatch(check.id, caseId, snapshot.id, match, actorId);
  return { match };
}

/**
 * Ri-esegue il confronto per tutte le pratiche già con un dispositivo concreto quando arriva un
 * nuovo snapshot del registro (docs/SPEC-AUTOVELOX-DRAFT.md §7bis) — un dispositivo può passare
 * da "non trovato" a "corrisponde" (o viceversa) senza che l'operatore debba riaprire la pratica.
 * Chiamato solo dopo uno snapshot realmente nuovo (mai su `unchanged: true`).
 */
export async function rematchDevicesForSnapshot(snapshotId: string, actorId: string | null): Promise<{ matchedCount: number }> {
  const snapshot = await prisma.speedRegistrySnapshot.findUniqueOrThrow({ where: { id: snapshotId } });
  const registryDevices = await loadDevicesFromSnapshot(snapshot.rawStorageKey);

  const checks = await prisma.enforcementDeviceCheck.findMany({
    where: { applicability: { in: APPLICABILITY_ELIGIBLE_FOR_MATCH } },
    select: { id: true, caseId: true },
  });

  let matchedCount = 0;
  for (const check of checks) {
    const identity = await loadDeviceIdentity(check.id);
    const { match } = matchDeviceAgainstRegistry(identity, registryDevices);
    if (match === null) continue;
    await persistMatch(check.id, check.caseId, snapshot.id, match, actorId);
    matchedCount += 1;
  }
  return { matchedCount };
}
