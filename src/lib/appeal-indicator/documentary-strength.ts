import type { AppealDocumentaryStrength } from "@/generated/prisma/enums";

/**
 * Asse documentale, fallback generico per multe senza modulo di verifica autovelox (non ancora
 * implementato — Tappa 4/6 di questa iniziativa): docs/SPEC-AUTOVELOX-DRAFT.md §15.3 proponeva
 * di riusare il campo estratto `missing_documents`. Verificato in questa tappa che
 * `missing_documents` non viene mai persistito come `CaseField`
 * (`src/lib/pipeline/persist-extraction.ts:52`, "salta array semplici (missing_data,
 * missing_documents)") — non esiste quindi oggi alcun segnale reale da cui derivare
 * DEBOLI/RILEVANTI/FORTI senza il modulo autovelox. Restituire sempre `NONE` in questo caso è
 * la scelta onesta (nessun elemento documentale accertato), non un difetto: meglio "nessun
 * segnale" che un segnale inventato. Quando il modulo autovelox sarà disponibile (Tappa 4/6),
 * questa funzione andrà sostituita — per le pratiche a cui si applica — dai segnali più ricchi
 * descritti in quella sezione (`registryMatch`, stato dei certificati).
 */
export function deriveGenericDocumentaryStrength(): AppealDocumentaryStrength {
  return "NONE";
}
