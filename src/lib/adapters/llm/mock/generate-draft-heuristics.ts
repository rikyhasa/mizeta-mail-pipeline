import type { CaseCategory } from "@/generated/prisma/enums";
import type { DraftGenerationInput } from "@/lib/adapters/llm/types";
import type { DraftGenerationResult } from "@/lib/adapters/llm/schemas/draft";
import { fieldLabel, formatFieldValue } from "@/lib/i18n/field-labels";

interface DefaultSkeleton {
  subject: string;
  body: string;
}

const DEFAULT_SKELETON_BY_CATEGORY: Partial<Record<CaseCategory, DefaultSkeleton>> = {
  QUOTE_REQUEST: {
    subject: "Preventivo trasporto - {{customer_name}}",
    body: [
      "Gentile {{contact_name}},",
      "",
      "La ringraziamo per la Sua richiesta di preventivo.",
      "",
      "Ritiro: {{pickup_location}} — Consegna: {{delivery_location}}",
      "Data ritiro: {{pickup_datetime}}",
      "Prezzo proposto: {{requested_or_proposed_price}} EUR",
      "",
      "Restiamo a disposizione per ogni chiarimento.",
      "",
      "Cordiali saluti",
    ].join("\n"),
  },
  CUSTOMER_RECEIVABLE: {
    subject: "Sollecito pagamento fattura {{invoice_number}}",
    body: [
      "Gentile {{customer_name}},",
      "",
      "La contattiamo in merito alla fattura n. {{invoice_number}} del {{invoice_date}}, di importo {{amount}} EUR, con scadenza {{due_date}}.",
      "",
      "Ad oggi risulta ancora non saldata. La invitiamo a regolarizzare la posizione o a comunicarci eventuali contestazioni.",
      "",
      "Cordiali saluti",
    ].join("\n"),
  },
  CLAIM_OR_DAMAGE: {
    subject: "Riscontro reclamo - {{customer_name}}",
    body: [
      "Gentile {{customer_name}},",
      "",
      "Abbiamo preso in carico la Sua segnalazione relativa a {{shipment_or_trip_reference}} del {{event_date}}.",
      "",
      "Stiamo verificando quanto riportato ({{damage_description}}) e Le forniremo un riscontro a breve.",
      "",
      "Cordiali saluti",
    ].join("\n"),
  },
};

const GENERIC_SKELETON: DefaultSkeleton = {
  subject: "Comunicazione in merito alla pratica",
  body: ["Gentile Cliente,", "", "{{summary}}", "", "Restiamo a disposizione per ogni chiarimento.", "", "Cordiali saluti"].join("\n"),
};

function formatToken(key: string, value: string | number | boolean | null): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? "Sì" : "No";
  return formatFieldValue(key, String(value));
}

function fillTemplate(
  template: string,
  values: Record<string, string | number | boolean | null>,
): { text: string; placeholders: string[] } {
  const placeholders: string[] = [];
  const text = template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const formatted = formatToken(key, values[key] ?? null);
    if (formatted !== null && formatted.length > 0) return formatted;
    const label = key === "summary" ? "sintesi" : fieldLabel(key);
    placeholders.push(label);
    return `[[DA COMPLETARE: ${label}]]`;
  });
  return { text, placeholders };
}

/**
 * Riempimento template euristico (SPEC.md §11): sostituisce `{{campo}}` con i valori già
 * estratti/confermati; i dati mancanti diventano placeholder evidenziati, mai inventati
 * (CLAUDE.md invariante 6). Usa il `ReplyTemplate` passato in input se presente, altrimenti
 * uno scheletro di default per categoria.
 */
export function generateDraftHeuristically(input: DraftGenerationInput): DraftGenerationResult {
  const skeleton = DEFAULT_SKELETON_BY_CATEGORY[input.category] ?? GENERIC_SKELETON;
  const subjectTemplate = input.templateSubject ?? skeleton.subject;
  const bodyTemplate = input.templateBody ?? skeleton.body;

  const values: Record<string, string | number | boolean | null> = {
    ...input.extractedFieldValues,
    summary: input.classificationSummary,
  };

  const subjectResult = fillTemplate(subjectTemplate, values);
  const bodyResult = fillTemplate(bodyTemplate, values);
  const placeholders = [...new Set([...subjectResult.placeholders, ...bodyResult.placeholders])];

  return {
    subject: subjectResult.text,
    body_text: bodyResult.text,
    placeholders,
    confidence: placeholders.length === 0 ? 0.9 : Math.max(0.3, 0.9 - placeholders.length * 0.15),
    needs_human_review: placeholders.length > 0,
  };
}
