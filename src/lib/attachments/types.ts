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

export type AttachmentExtractionOutcome =
  | StructuredExtractionSuccess
  | PagedExtractionSuccess
  | ExtractionFailure
  | ExtractionDeferred;

export interface AttachmentToExtract {
  attachmentId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  content: Buffer;
}
