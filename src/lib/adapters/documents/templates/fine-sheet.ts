import { CATEGORY_FIELD_ORDER } from "@/lib/i18n/field-labels";
import { type DocumentCaseField, type DocumentCaseInfo, renderCaseHeader, renderDocumentShell, renderFieldTable } from "./shared";

/** Scheda multa (SPEC.md §12, FINE_SHEET). */
export function renderFineSheetHtml(caseInfo: DocumentCaseInfo, fields: DocumentCaseField[]): string {
  const body = `
    ${renderCaseHeader("Scheda multa", caseInfo)}
    ${renderFieldTable(CATEGORY_FIELD_ORDER.FINE_OR_PENALTY, fields)}
  `;
  return renderDocumentShell(`Scheda multa — ${caseInfo.reference}`, body);
}
