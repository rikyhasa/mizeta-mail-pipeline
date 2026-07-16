import { AlertTriangle, Check } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";
import { Badge } from "@/components/ui/Badge";
import { FieldEditForm } from "./FieldEditForm";
import { FieldSourceInfo } from "./FieldSourceInfo";
import type { FieldSourceType } from "@/generated/prisma/enums";
import type { FieldTier } from "./field-tiers";

interface FieldData {
  value: string | null;
  confidence: number | null;
  needsHumanReview: boolean;
  confirmedBy: { name: string } | null;
  sourceType: FieldSourceType | null;
  sourceMessageId: string | null;
  sourceAttachmentId: string | null;
}

/**
 * Una delle tre presentazioni per un dato estratto, in base al tier calcolato
 * da `classifyFieldTier`: compatta (confermato), evidente (problematico),
 * sobria (il resto). Riusa FieldEditForm/FieldSourceInfo/ActionButton senza
 * modificarli.
 */
export function ExtractedFieldCell({
  caseId,
  fieldKey,
  label,
  formattedValue,
  field,
  tier,
  spanFull = false,
}: {
  caseId: string;
  fieldKey: string;
  label: string;
  formattedValue: string | null;
  field: FieldData;
  tier: FieldTier;
  /** Fa occupare al campo entrambe le colonne della griglia compatta (usato per l'ultimo
   * campo quando il totale è dispari, cosi la griglia non lascia mai una cella vuota). */
  spanFull?: boolean;
}) {
  const pct = field.confidence !== null ? Math.round(field.confidence * 100) : null;
  const showLowConfidence = tier === "middle" && !field.needsHumanReview && pct !== null && pct < 70;

  const labelEl = <span className="detail-label">{label}</span>;
  const sourceInfo = (
    <FieldSourceInfo
      sourceType={field.sourceType}
      sourceMessageId={field.sourceMessageId}
      sourceAttachmentId={field.sourceAttachmentId}
    />
  );

  if (tier === "problematic") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 rounded-lg border border-[color-mix(in_srgb,var(--color-warning)_35%,white)] bg-[var(--color-warning-soft)] px-3 py-2">
        <div className="flex min-w-0 items-baseline gap-2">
          {labelEl}
          {formattedValue && <span className="truncate text-sm text-[var(--color-ink)]">{formattedValue}</span>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Badge tone="warning" icon={AlertTriangle}>
            {!field.value ? "Mancante" : `Da verificare${pct !== null ? ` · ${pct}%` : ""}`}
          </Badge>
          {!field.confirmedBy && (
            <ActionButton method="PATCH" url={`/api/cases/${caseId}/fields/${fieldKey}`} body={{}} size="sm">
              Conferma
            </ActionButton>
          )}
          <FieldEditForm caseId={caseId} fieldKey={fieldKey} initialValue={field.value ?? ""} />
          {sourceInfo}
        </div>
      </div>
    );
  }

  if (tier === "confirmed") {
    return (
      <div className={`flex flex-col gap-1 bg-white p-3.5 ${spanFull ? "sm:col-span-2" : ""}`}>
        {labelEl}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="detail-value">{formattedValue}</span>
          <span title={field.confirmedBy ? `Confermato da ${field.confirmedBy.name}` : undefined}>
            <Check className="h-3.5 w-3.5 text-[var(--color-forest)]" aria-hidden="true" />
            <span className="sr-only">{field.confirmedBy ? `Confermato da ${field.confirmedBy.name}` : "Confermato"}</span>
          </span>
          <FieldEditForm caseId={caseId} fieldKey={fieldKey} initialValue={field.value ?? ""} />
          {sourceInfo}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1 bg-white p-3.5 ${spanFull ? "sm:col-span-2" : ""}`}>
      {labelEl}
      <div className="flex flex-wrap items-center gap-2">
        <span className="detail-value font-normal">{formattedValue}</span>
        {showLowConfidence && <span className="text-xs text-[var(--color-ink-muted)]">Confidenza {pct}%</span>}
        <ActionButton method="PATCH" url={`/api/cases/${caseId}/fields/${fieldKey}`} body={{}} variant="tertiary" size="sm">
          Conferma
        </ActionButton>
        <FieldEditForm caseId={caseId} fieldKey={fieldKey} initialValue={field.value ?? ""} />
        {sourceInfo}
      </div>
    </div>
  );
}
