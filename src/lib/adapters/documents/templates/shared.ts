import { fieldLabel, formatFieldValue } from "@/lib/i18n/field-labels";
import { formatDateTime } from "@/lib/format";

/**
 * Ogni valore interpolato in questi template proviene, in ultima analisi, dal contenuto di
 * un'email (CLAUDE.md invariante 1): un valore non escapato potrebbe rompere la struttura HTML
 * del documento stesso (o, nel caso limite, iniettare markup). `escapeHtml` è applicato SEMPRE,
 * senza eccezioni, a ogni stringa che finisce nel corpo del documento.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface DocumentCaseField {
  fieldKey: string;
  value: string | null;
  needsHumanReview: boolean;
}

export interface DocumentCaseInfo {
  reference: string;
  title: string;
  customerName?: string | null;
  supplierName?: string | null;
  createdAt: Date;
}

/** CSS scritto a mano: Tailwind non è disponibile fuori dal ciclo di richiesta Next.js per una
 * stringa renderizzata da Puppeteer (nessuna dipendenza da un server in esecuzione). */
export const DOCUMENT_BASE_STYLES = `
  body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; margin: 0; padding: 32px; font-size: 13px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .subtitle { color: #64748b; font-size: 12px; margin: 0 0 20px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  td, th { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  th { width: 220px; color: #475569; font-weight: 600; }
  .review-flag { color: #b45309; font-size: 11px; margin-left: 6px; }
  .footer { margin-top: 24px; color: #94a3b8; font-size: 10px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
`;

export function renderDocumentShell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>${DOCUMENT_BASE_STYLES}</style>
</head>
<body>
  ${bodyHtml}
  <div class="footer">Generato automaticamente da Mizeta Mail Pipeline il ${escapeHtml(formatDateTime(new Date()))}. Dati soggetti a verifica umana dove indicato.</div>
</body>
</html>`;
}

export function renderCaseHeader(title: string, caseInfo: DocumentCaseInfo): string {
  const subtitleParts = [
    `Pratica ${caseInfo.reference}`,
    caseInfo.customerName ? `Cliente: ${caseInfo.customerName}` : null,
    caseInfo.supplierName ? `Fornitore: ${caseInfo.supplierName}` : null,
  ].filter((part): part is string => Boolean(part));

  return `
    <h1>${escapeHtml(title)}</h1>
    <p class="subtitle">${escapeHtml(subtitleParts.join(" · "))}</p>
  `;
}

export function renderFieldTable(fieldOrder: string[], fields: DocumentCaseField[]): string {
  const byKey = new Map(fields.map((f) => [f.fieldKey, f]));
  const rows = fieldOrder
    .map((fieldKey) => {
      const field = byKey.get(fieldKey);
      const rawValue = field?.value ?? null;
      const displayValue = rawValue !== null ? formatFieldValue(fieldKey, rawValue) : "—";
      const reviewFlag = field?.needsHumanReview ? '<span class="review-flag">da verificare</span>' : "";
      return `<tr><th>${escapeHtml(fieldLabel(fieldKey))}</th><td>${escapeHtml(displayValue)}${reviewFlag}</td></tr>`;
    })
    .join("");

  return `<table>${rows}</table>`;
}
