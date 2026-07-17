import { z } from "zod";
import { extractedField, extractedStringField } from "./extraction-common";
import { ENFORCEMENT_CHECK_APPLICABILITY_LABELS } from "@/lib/i18n/labels";
import type { EnforcementCheckApplicability } from "@/generated/prisma/enums";

const APPLICABILITY_VALUES = Object.keys(ENFORCEMENT_CHECK_APPLICABILITY_LABELS) as [
  EnforcementCheckApplicability,
  ...EnforcementCheckApplicability[],
];

/**
 * Applicabilità + dati tecnici del dispositivo (docs/SPEC-AUTOVELOX-DRAFT.md §4, §6, §7) — un
 * passaggio separato dall'estrazione principale di FINE_OR_PENALTY, eseguito solo dopo che una
 * pratica è già classificata in quella categoria. Stessa forma "campo estratto" del resto della
 * pipeline (value/normalized_value/confidence/source_type/source_message_id/
 * source_attachment_id/source_page/source_excerpt/needs_human_review) — riusata anche per
 * `applicability`, che però non è mai `null`: quando nessun segnale è disponibile il valore
 * ricade su NOT_APPLICABLE con confidenza bassa, non su un dato mancante (è comunque sempre
 * una classificazione, come `primary_category`, mai un fatto estratto testualmente).
 *
 * `driver_professional_cqc` NON compare in questo schema: mai estratto o dedotto dal modello
 * (CLAUDE.md invariante 6, richiesta esplicita dell'utente in FASE E) — solo confermato da un
 * operatore (docs/SPEC.md §10bis).
 */
export const enforcementDeviceAnalysisSchema = z.object({
  applicability: extractedField(z.enum(APPLICABILITY_VALUES)),
  manufacturer: extractedStringField,
  model: extractedStringField,
  version: extractedStringField,
  serial_number: extractedStringField,
  decree_number: extractedStringField,
  decree_date: extractedStringField,
  authority: extractedStringField,
});

export type EnforcementDeviceAnalysisResult = z.infer<typeof enforcementDeviceAnalysisSchema>;
