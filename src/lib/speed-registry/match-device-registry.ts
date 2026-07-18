import type { EnforcementRegistryMatchState } from "@/generated/prisma/enums";
import type { SpeedRegistryDeviceRow } from "./types";

export interface DeviceIdentityForMatch {
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  decreeNumber: string | null;
}

export interface MatchDeviceAgainstRegistryResult {
  /** null quando mancano identificativi forti (matricola o numero decreto) per cercare nel
   * registro — nessun esito da scrivere in quel caso, mai un NOT_FOUND per assenza di dati da
   * confrontare (quella distinzione resta a chi chiama, vedi documentary-strength.ts). */
  match: EnforcementRegistryMatchState | null;
  matchedRow: SpeedRegistryDeviceRow | null;
}

function normalize(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase().replace(/\s+/g, " ");
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Confronto deterministico dispositivo↔registro MIT (docs/SPEC-AUTOVELOX-DRAFT.md §7bis/§15.3):
 * mai un modello LLM, solo confronto di stringhe normalizzate. Cerca prima per matricola (l'unico
 * identificativo pensato per essere univoco per dispositivo fisico), poi per numero decreto come
 * fallback. Se trovato, produttore/modello vengono confrontati solo come conferma incrociata
 * quando entrambi i lati li dichiarano — un campo mancante da un lato non genera mai un
 * MISMATCH artificiale.
 */
export function matchDeviceAgainstRegistry(
  device: DeviceIdentityForMatch,
  registryDevices: SpeedRegistryDeviceRow[],
): MatchDeviceAgainstRegistryResult {
  const serialNumber = normalize(device.serialNumber);
  const decreeNumber = normalize(device.decreeNumber);

  if (!serialNumber && !decreeNumber) {
    return { match: null, matchedRow: null };
  }

  const bySerial = serialNumber ? (registryDevices.find((row) => normalize(row.serialNumber) === serialNumber) ?? null) : null;
  const byDecree = !bySerial && decreeNumber ? (registryDevices.find((row) => normalize(row.decreeNumber) === decreeNumber) ?? null) : null;
  const matchedRow = bySerial ?? byDecree;

  if (!matchedRow) {
    return { match: "NOT_FOUND", matchedRow: null };
  }

  const manufacturer = normalize(device.manufacturer);
  const model = normalize(device.model);
  const manufacturerConflict = manufacturer !== null && normalize(matchedRow.manufacturer) !== null && manufacturer !== normalize(matchedRow.manufacturer);
  const modelConflict = model !== null && normalize(matchedRow.model) !== null && model !== normalize(matchedRow.model);

  return { match: manufacturerConflict || modelConflict ? "MISMATCH" : "MATCH", matchedRow };
}
