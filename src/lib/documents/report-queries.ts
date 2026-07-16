import { prisma } from "@/lib/db/prisma";
import type { CaseCategory, GeneratedDocumentType } from "@/generated/prisma/enums";

export interface DocumentTemplateStats {
  type: GeneratedDocumentType;
  count: number;
  lastGeneratedAt: Date | null;
}

/** Solo i 3 tipi con generazione reale implementata (SPEC.md §12, coerente con
 * DOCUMENT_TYPE_BY_CATEGORY in pratiche/[id]/page.tsx e IMPLEMENTED_TYPES nella route API) —
 * mappa inversa tipo → categoria, per collegare la galleria alle pratiche giuste. Gli altri 5
 * tipi (Scheda ordine di trasporto + i 4 report aggregati) non hanno alcuna generazione
 * server-side: nessuna riga finta, "Non ancora disponibile" onesto. */
export const CATEGORY_BY_IMPLEMENTED_TYPE: Partial<Record<GeneratedDocumentType, CaseCategory>> = {
  QUOTE_SHEET: "QUOTE_REQUEST",
  CLAIM_DOSSIER: "CLAIM_OR_DAMAGE",
  FINE_SHEET: "FINE_OR_PENALTY",
};

/** Conteggio reale + data dell'ultima generazione per tipo, su tutte le pratiche — nessun dato
 * finto: solo un'aggregazione di `GeneratedDocument` già esistenti. */
export async function getDocumentTemplateStats(): Promise<DocumentTemplateStats[]> {
  const grouped = await prisma.generatedDocument.groupBy({
    by: ["type"],
    _count: { _all: true },
    _max: { createdAt: true },
  });
  return grouped.map((g) => ({ type: g.type, count: g._count._all, lastGeneratedAt: g._max.createdAt }));
}
