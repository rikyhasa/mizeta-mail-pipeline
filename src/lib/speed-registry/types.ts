/**
 * Una riga del registro MIT dispositivi di rilevamento velocità (docs/SPEC-AUTOVELOX-DRAFT.md
 * §7bis): 13 colonne verificate leggendo la pagina reale di velox.mit.gov.it/dispositivi.
 * Mappa 1:1 sui campi già proposti per `EnforcementDeviceField` (manufacturer/model/version/
 * serialNumber/decreeNumber/decreeDate/authority — qui `accertatoreCode` è l'autorità).
 */
export interface SpeedRegistryDeviceRow {
  accertatoreCode: string | null;
  deviceName: string | null;
  cadastralCode: string | null;
  decreeNumber: string | null;
  decreeDate: string | null;
  deviceType: string | null;
  manufacturer: string | null;
  model: string | null;
  version: string | null;
  serialNumber: string | null;
  notes: string | null;
  lastCommunicationDate: string | null;
  firstRegisteredDate: string | null;
}

export interface ParseSpeedRegistryResult {
  devices: SpeedRegistryDeviceRow[];
  /** Righe con un numero di colonne diverso da quello atteso: scartate singolarmente, mai
   * l'intero parsing — un'unica riga imprevista non deve far fallire l'intero sync giornaliero. */
  malformedRowCount: number;
}

export interface SpeedRegistryDiffSummary {
  addedCount: number;
  removedCount: number;
  changedCount: number;
  /** Chiavi identificative capate (nessun blob enorme in DB); `truncated` segnala l'omissione. */
  added: string[];
  removed: string[];
  changed: string[];
  truncated: boolean;
}

export interface SpeedRegistrySyncResult {
  /** null quando l'hash è identico allo snapshot precedente: nessuno snapshot duplicato creato
   * (decisione presa in Tappa 5, si veda il commit), solo un audit log "nessuna modifica". */
  snapshotId: string | null;
  unchanged: boolean;
  deviceCount: number;
  malformedRowCount: number;
  diff: SpeedRegistryDiffSummary | null;
}
