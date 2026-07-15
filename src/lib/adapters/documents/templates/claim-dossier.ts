import { CATEGORY_FIELD_ORDER } from "@/lib/i18n/field-labels";
import { type DocumentCaseField, type DocumentCaseInfo, renderCaseHeader, renderDocumentShell, renderFieldTable } from "./shared";

/** Dossier reclamo/sinistro (SPEC.md §12, CLAIM_DOSSIER). */
export function renderClaimDossierHtml(caseInfo: DocumentCaseInfo, fields: DocumentCaseField[]): string {
  const body = `
    ${renderCaseHeader("Dossier reclamo", caseInfo)}
    ${renderFieldTable(CATEGORY_FIELD_ORDER.CLAIM_OR_DAMAGE, fields)}
  `;
  return renderDocumentShell(`Dossier reclamo — ${caseInfo.reference}`, body);
}
