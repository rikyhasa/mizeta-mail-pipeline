/** Esiti possibili di un tentativo di estrazione di un singolo allegato (FASE 10,
 * docs/FASE-10-LETTURA-ALLEGATI.md). Un fallimento di un livello non lancia mai
 * eccezione verso il chiamante: è sempre uno di questi esiti tipizzati, mai un errore
 * che farebbe fallire l'intero job (`mai bloccare l'intera email`). */

export interface StructuredExtractionSuccess {
  status: "SUCCEEDED";
  method: "STRUCTURED";
  /** fieldKey (stessi nomi di supplierInvoiceExtractionSchema) -> valore grezzo. */
  structuredFields: Record<string, string | number | boolean>;
}

export interface PagedExtractionSuccess {
  status: "SUCCEEDED";
  method: "LOCAL_TEXT" | "VISION";
  pages: { page: number; text: string }[];
  pageCount: number;
  extractionCostUsd: number | null;
  /** Presente solo su un'estrazione parziale (es. limite pagine superato). */
  partialNote?: string;
}

export interface ExtractionFailure {
  status: "FAILED";
  reason: string;
}

export interface ExtractionDeferred {
  status: "DEFERRED_BUDGET";
  reason: string;
}

/** Testo locale già estratto e usabile, ma il fallback visione (necessario per bassa densità
 * testuale) è stato rinviato per budget esaurito — mai scartare il testo locale già ottenuto,
 * ma nemmeno spacciarlo per un'estrazione completa: il job di retry deve poterlo riprendere. */
export interface PartialVisionDeferred {
  status: "PARTIAL_VISION_DEFERRED";
  method: "LOCAL_TEXT";
  pages: { page: number; text: string }[];
  pageCount: number;
  reason: string;
}

/** Formato riconosciuto (es. HEIC/HEIF) ma volutamente mai estratto: nessun decoder aggiunto,
 * segnalato esplicitamente per la conversione manuale — distinto da FAILED, che resta per gli
 * errori di parsing veri e propri su un formato altrimenti supportato. */
export interface ExtractionUnsupportedFormat {
  status: "UNSUPPORTED_FORMAT";
  reason: string;
}

export type AttachmentExtractionOutcome =
  | StructuredExtractionSuccess
  | PagedExtractionSuccess
  | ExtractionFailure
  | ExtractionDeferred
  | ExtractionUnsupportedFormat
  | PartialVisionDeferred;

export interface AttachmentToExtract {
  attachmentId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  content: Buffer;
}
