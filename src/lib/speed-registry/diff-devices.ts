import type { SpeedRegistryDeviceRow, SpeedRegistryDiffSummary } from "./types";

const DIFF_ENTRY_CAP = 200;

/**
 * Il registro non espone un identificativo univoco per dispositivo: usiamo una chiave composita
 * best-effort (codice catastale + matricola + nome dispositivo) come proxy di identità fra due
 * sync consecutivi — sufficiente per un diff informativo (added/removed/changed), mai una
 * garanzia legale di identità del dispositivo fisico.
 */
function deviceIdentityKey(row: SpeedRegistryDeviceRow): string {
  const parts = [row.cadastralCode, row.serialNumber, row.deviceName].filter((v): v is string => Boolean(v));
  return parts.length > 0 ? parts.join("::") : `riga-senza-identita::${JSON.stringify(row)}`;
}

/** Confronta la lista dispositivi dell'ultimo snapshot con quella corrente (docs/SPEC-AUTOVELOX-DRAFT.md
 * §7bis). Conteggi sempre esatti; le liste di chiavi sono capate per non gonfiare il JSON in DB —
 * `truncated` segnala quando l'omissione è avvenuta (mai un troncamento silenzioso). */
export function diffDeviceLists(previous: SpeedRegistryDeviceRow[], current: SpeedRegistryDeviceRow[]): SpeedRegistryDiffSummary {
  const previousByKey = new Map(previous.map((row) => [deviceIdentityKey(row), row]));
  const currentByKey = new Map(current.map((row) => [deviceIdentityKey(row), row]));

  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];

  for (const [key, row] of currentByKey) {
    const previousRow = previousByKey.get(key);
    if (!previousRow) {
      added.push(key);
      continue;
    }
    if (JSON.stringify(previousRow) !== JSON.stringify(row)) changed.push(key);
  }

  for (const key of previousByKey.keys()) {
    if (!currentByKey.has(key)) removed.push(key);
  }

  const truncated = added.length > DIFF_ENTRY_CAP || removed.length > DIFF_ENTRY_CAP || changed.length > DIFF_ENTRY_CAP;

  return {
    addedCount: added.length,
    removedCount: removed.length,
    changedCount: changed.length,
    added: added.slice(0, DIFF_ENTRY_CAP),
    removed: removed.slice(0, DIFF_ENTRY_CAP),
    changed: changed.slice(0, DIFF_ENTRY_CAP),
    truncated,
  };
}
