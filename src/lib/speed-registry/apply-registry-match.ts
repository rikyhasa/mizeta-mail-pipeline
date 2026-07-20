import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/pipeline/audit";
import type { EnforcementCheckApplicability, EnforcementRegistryMatchState } from "@/generated/prisma/enums";
import {
  matchDeviceAgainstRegistry,
  normalize,
  type DeviceIdentityFieldKey,
  type DeviceIdentityForMatch,
  type MatchDeviceAgainstRegistryResult,
} from "./match-device-registry";
import { loadDevicesFromSnapshot } from "./sync-speed-device-registry";
import type { SpeedRegistryDeviceRow } from "./types";

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

/** `DeviceIdentityFieldKey` (camelCase, forma del matcher) → `fieldKey` reale su
 * `EnforcementDeviceField` (snake_case per i due soli campi composti — gli altri coincidono).
 * Necessaria prima di scrivere `conflictingFields`/campi verificati verso il DB: senza questa
 * mappa `serialNumber`/`decreeNumber` punterebbero a `fieldKey` inesistenti. */
const DEVICE_IDENTITY_FIELD_KEY_TO_DB_FIELD_KEY: Record<DeviceIdentityFieldKey, string> = {
  manufacturer: "manufacturer",
  model: "model",
  serialNumber: "serial_number",
  decreeNumber: "decree_number",
  version: "version",
};

async function loadDeviceIdentity(checkId: string): Promise<DeviceIdentityForMatch> {
  const fields = await prisma.enforcementDeviceField.findMany({
    where: { checkId, fieldKey: { in: ["manufacturer", "model", "version", "serial_number", "decree_number"] } },
    select: { fieldKey: true, value: true },
  });
  const byKey = new Map(fields.map((f) => [f.fieldKey, f.value]));
  return {
    manufacturer: byKey.get("manufacturer") ?? null,
    model: byKey.get("model") ?? null,
    serialNumber: byKey.get("serial_number") ?? null,
    decreeNumber: byKey.get("decree_number") ?? null,
    version: byKey.get("version") ?? null,
  };
}

/**
 * Determina quali `EnforcementDeviceField` sono stati realmente confrontati con la riga di
 * registro trovata e coincidono — mai un campo il cui lato registro è null (nulla da
 * confrontare) né un campo diverso da quello usato per la ricerca (l'altro identificativo,
 * es. decree_number quando la ricerca è avvenuta per matricola, non viene mai confrontato dal
 * matcher: non va trattato come verificato). Usata solo su `match === "MATCH"` (Troncone C,
 * §2.1.A) — mai su MISMATCH/NOT_FOUND/ambiguous.
 */
function determineRegistryVerifiedFieldKeys(identity: DeviceIdentityForMatch, matchedRow: SpeedRegistryDeviceRow): string[] {
  const verified: string[] = [];
  if (identity.serialNumber !== null && matchedRow.serialNumber !== null && normalize(identity.serialNumber) === normalize(matchedRow.serialNumber)) {
    verified.push("serial_number");
  }
  if (identity.decreeNumber !== null && matchedRow.decreeNumber !== null && normalize(identity.decreeNumber) === normalize(matchedRow.decreeNumber)) {
    verified.push("decree_number");
  }
  if (identity.manufacturer !== null && matchedRow.manufacturer !== null) verified.push("manufacturer");
  if (identity.model !== null && matchedRow.model !== null) verified.push("model");
  if (identity.version !== null && matchedRow.version !== null) verified.push("version");
  return verified;
}

/**
 * Traduce l'esito puro di `matchDeviceAgainstRegistry` in quali campi vanno auto-verificati o
 * rimessi in revisione (Troncone C, §2.1.A/§2.4). Un match "ambiguous" (più righe di registro
 * con lo stesso identificativo) non tocca alcun campo anche se `match === "MATCH"`: il candidato
 * scelto non è abbastanza univoco per esentare l'operatore dalla revisione.
 */
function computeFieldUpdates(
  identity: DeviceIdentityForMatch,
  result: MatchDeviceAgainstRegistryResult,
): { verifiedFieldKeys: string[]; conflictingFieldKeys: string[] } {
  if (result.match === "MATCH" && !result.ambiguous && result.matchedRow) {
    return { verifiedFieldKeys: determineRegistryVerifiedFieldKeys(identity, result.matchedRow), conflictingFieldKeys: [] };
  }
  if (result.match === "MISMATCH") {
    return { verifiedFieldKeys: [], conflictingFieldKeys: result.conflictingFields.map((f) => DEVICE_IDENTITY_FIELD_KEY_TO_DB_FIELD_KEY[f]) };
  }
  return { verifiedFieldKeys: [], conflictingFieldKeys: [] };
}

async function persistMatch(
  checkId: string,
  caseId: string,
  snapshotId: string,
  match: EnforcementRegistryMatchState,
  actorId: string | null,
  fieldUpdates: { verifiedFieldKeys: string[]; conflictingFieldKeys: string[] },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.enforcementDeviceCheck.update({
      where: { id: checkId },
      data: { registryMatch: match, registrySnapshotId: snapshotId },
    });

    // Dati verificati deterministicamente dal registro MIT (Troncone C, §2.1.A): nessun click
    // umano, nessun confirmedById scritto (nessun umano ha agito) — solo needsHumanReview
    // azzerato, con provenienza tracciata dall'audit ENFORCEMENT_REGISTRY_MATCHED sotto, non da
    // un nuovo campo per-field.
    for (const fieldKey of fieldUpdates.verifiedFieldKeys) {
      await tx.enforcementDeviceField.updateMany({
        where: { checkId, fieldKey },
        data: { needsHumanReview: false },
      });
    }
    // Solo i campi realmente in conflitto tornano/restano da rivedere — mai tutti i campi del
    // dispositivo indiscriminatamente.
    for (const fieldKey of fieldUpdates.conflictingFieldKeys) {
      await tx.enforcementDeviceField.updateMany({
        where: { checkId, fieldKey },
        data: { needsHumanReview: true },
      });
    }

    await writeAuditLog(tx, {
      action: "ENFORCEMENT_REGISTRY_MATCHED",
      entityType: "EnforcementDeviceCheck",
      entityId: checkId,
      caseId,
      actorId: actorId ?? undefined,
      metadata: { match, snapshotId, verifiedFieldKeys: fieldUpdates.verifiedFieldKeys, conflictingFieldKeys: fieldUpdates.conflictingFieldKeys },
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
  const result = matchDeviceAgainstRegistry(identity, registryDevices);
  if (result.match === null) return { match: null };

  await persistMatch(check.id, caseId, snapshot.id, result.match, actorId, computeFieldUpdates(identity, result));
  return { match: result.match };
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
    const result = matchDeviceAgainstRegistry(identity, registryDevices);
    if (result.match === null) continue;
    await persistMatch(check.id, check.caseId, snapshot.id, result.match, actorId, computeFieldUpdates(identity, result));
    matchedCount += 1;
  }
  return { matchedCount };
}
