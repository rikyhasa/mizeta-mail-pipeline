import { CATEGORY_FIELD_ORDER } from "@/lib/i18n/field-labels";
import { type DocumentCaseField, type DocumentCaseInfo, renderCaseHeader, renderDocumentShell, renderFieldTable } from "./shared";

/** Scheda preventivo (SPEC.md §12, QUOTE_SHEET). */
export function renderQuoteSheetHtml(caseInfo: DocumentCaseInfo, fields: DocumentCaseField[]): string {
  const body = `
    ${renderCaseHeader("Scheda preventivo", caseInfo)}
    ${renderFieldTable(CATEGORY_FIELD_ORDER.QUOTE_REQUEST, fields)}
  `;
  return renderDocumentShell(`Scheda preventivo — ${caseInfo.reference}`, body);
}
