import { ENFORCEMENT_DOCUMENT_TYPE_LABELS } from "@/lib/i18n/labels";
import type { EnforcementDocumentType } from "@/generated/prisma/enums";

/** Tutti i tipi documento gestiti dal modulo, incluso il catch-all `OTHER` — usato solo per
 * l'elenco completo mostrato in UI (checklist, richiesta documenti). */
export const ALL_ENFORCEMENT_DOCUMENT_TYPES = Object.keys(ENFORCEMENT_DOCUMENT_TYPE_LABELS) as EnforcementDocumentType[];

/** Tipi tecnici la cui assenza blocca la pratica: `OTHER` è un catch-all facoltativo, mai
 * obbligatorio (FASE 12, Bug 3 — prima contava come uno dei tipi da avere `PRESENT`, bloccando
 * pratiche a cui mancava solo un documento generico irrilevante). */
export const REQUIRED_ENFORCEMENT_DOCUMENT_TYPES = ALL_ENFORCEMENT_DOCUMENT_TYPES.filter(
  (type) => type !== "OTHER",
);

/**
 * Numero di documenti tecnici richiesti ancora mancanti. Sia il denominatore (solo i tipi
 * richiesti, non tutti e 5) sia il numeratore (solo i `PRESENT` di tipo richiesto) escludono
 * `OTHER`: un `OTHER` presente non deve mai mascherare un tipo tecnico specifico mancante.
 */
export function countMissingRequiredDocuments(documentChecks: { documentType: EnforcementDocumentType; status: string }[]): number {
  const presentRequiredCount = documentChecks.filter(
    (doc) => doc.status === "PRESENT" && (REQUIRED_ENFORCEMENT_DOCUMENT_TYPES as string[]).includes(doc.documentType),
  ).length;
  return REQUIRED_ENFORCEMENT_DOCUMENT_TYPES.length - presentRequiredCount;
}
