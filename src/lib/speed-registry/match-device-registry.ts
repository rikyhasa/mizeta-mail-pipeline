import type { EnforcementRegistryMatchState } from "@/generated/prisma/enums";
import type { SpeedRegistryDeviceRow } from "./types";

export interface DeviceIdentityForMatch {
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  decreeNumber: string | null;
}

export type DeviceIdentityFieldKey = "manufacturer" | "model";

export interface MatchDeviceAgainstRegistryResult {
  /** null quando mancano identificativi forti (matricola o numero decreto) per cercare nel
   * registro — nessun esito da scrivere in quel caso, mai un NOT_FOUND per assenza di dati da
   * confrontare (quella distinzione resta a chi chiama, vedi documentary-strength.ts). */
  match: EnforcementRegistryMatchState | null;
  matchedRow: SpeedRegistryDeviceRow | null;
  /** Quali campi divergono dalla riga trovata (solo quando match === "MISMATCH") — permette a
   * chi chiama di intervenire solo sui campi realmente in conflitto, non su tutti i campi del
   * dispositivo indiscriminatamente (Troncone C). */
  conflictingFields: DeviceIdentityFieldKey[];
  /** true quando la ricerca per matricola (o, in fallback, numero decreto) trova più di una riga
   * nel registro con lo stesso identificativo — il registro non garantisce l'unicità
   * dell'identificativo (vedi diff-devices.ts, "proxy di identità best-effort"), quindi in
   * questo caso il "MATCH" scelto è solo il primo candidato, non un'identificazione univoca:
   * chi chiama non deve mai trattarlo come sufficientemente certo per un'auto-conferma
   * (Troncone C, §2.4) anche se `match` risulta "MATCH". */
  ambiguous: boolean;
}

/** Esportata per riuso in apply-registry-match.ts (Troncone C): serve a determinare quali campi
 * sono stati realmente confrontati con la riga di registro trovata, non solo se sono in
 * conflitto — stessa normalizzazione usata qui, per non farle divergere. */
export function normalize(value: string | null): string | null {
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
    return { match: null, matchedRow: null, conflictingFields: [], ambiguous: false };
  }

  const bySerialRows = serialNumber ? registryDevices.filter((row) => normalize(row.serialNumber) === serialNumber) : [];
  const byDecreeRows = bySerialRows.length === 0 && decreeNumber ? registryDevices.filter((row) => normalize(row.decreeNumber) === decreeNumber) : [];
  const candidateRows = bySerialRows.length > 0 ? bySerialRows : byDecreeRows;
  const matchedRow = candidateRows[0] ?? null;
  const ambiguous = candidateRows.length > 1;

  if (!matchedRow) {
    return { match: "NOT_FOUND", matchedRow: null, conflictingFields: [], ambiguous: false };
  }

  const manufacturer = normalize(device.manufacturer);
  const model = normalize(device.model);
  const manufacturerConflict = manufacturer !== null && normalize(matchedRow.manufacturer) !== null && manufacturer !== normalize(matchedRow.manufacturer);
  const modelConflict = model !== null && normalize(matchedRow.model) !== null && model !== normalize(matchedRow.model);
  const conflictingFields: DeviceIdentityFieldKey[] = [
    ...(manufacturerConflict ? (["manufacturer"] as const) : []),
    ...(modelConflict ? (["model"] as const) : []),
  ];

  return { match: conflictingFields.length > 0 ? "MISMATCH" : "MATCH", matchedRow, conflictingFields, ambiguous };
}
