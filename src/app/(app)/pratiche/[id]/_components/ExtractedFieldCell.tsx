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
 * Una sola cella per ogni campo, sempre nella stessa griglia compatta (FASE 8B): come
 * `.field` nella reference — riga principale con label+valore a sinistra e stato/azione
 * allineati a destra (`.field-top`), una riga sottile sotto per le affordance secondarie
 * (Modifica/Fonte), altezza complessiva ~90px indipendentemente dal tier.
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

  return (
    <div className={`flex flex-col gap-1.5 bg-white p-3.5 ${spanFull ? "min-[800px]:col-span-2" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="detail-label">{label}</span>
          <div className={tier === "confirmed" ? "detail-value truncate" : "detail-value truncate font-normal"}>
            {formattedValue ?? "—"}
          </div>
          {showLowConfidence && <span className="text-xs text-[var(--color-ink-muted)]">Confidenza {pct}%</span>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {tier === "problematic" && (
            <Badge tone="warning" icon={AlertTriangle}>
              {!field.value ? "Mancante" : `Da verificare${pct !== null ? ` · ${pct}%` : ""}`}
            </Badge>
          )}
          {tier === "confirmed" && (
            <span title={field.confirmedBy ? `Confermato da ${field.confirmedBy.name}` : undefined}>
              <Check className="h-3.5 w-3.5 text-[var(--color-forest)]" aria-hidden="true" />
              <span className="sr-only">{field.confirmedBy ? `Confermato da ${field.confirmedBy.name}` : "Confermato"}</span>
            </span>
          )}
          {!field.confirmedBy && (
            <ActionButton
              method="PATCH"
              url={`/api/cases/${caseId}/fields/${fieldKey}`}
              body={{}}
              variant={tier === "problematic" ? "secondary" : "tertiary"}
              size="sm"
            >
              Conferma
            </ActionButton>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <FieldEditForm caseId={caseId} fieldKey={fieldKey} initialValue={field.value ?? ""} />
        <FieldSourceInfo
          sourceType={field.sourceType}
          sourceMessageId={field.sourceMessageId}
          sourceAttachmentId={field.sourceAttachmentId}
        />
      </div>
    </div>
  );
}
