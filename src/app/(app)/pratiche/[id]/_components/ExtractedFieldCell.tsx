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
 * Una sola cella per ogni campo, sempre nella stessa griglia compatta (FASE 8B, iterazione
 * 3 — come `.field-list` nella reference: nessun campo renderizzato come riga a tutta
 * larghezza). Il tier calcolato da `classifyFieldTier` cambia solo cosa compare DENTRO la
 * cella — un badge piccolo per i problematici, un'icona per i confermati — non il
 * contenitore. Una sola azione inline primaria (Conferma, quando il campo non è ancora
 * confermato); Modifica e Fonte restano affordance a icona, non bottoni di testo.
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
    <div className={`flex flex-col gap-1 bg-white p-3.5 ${spanFull ? "min-[800px]:col-span-2" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="detail-label">{label}</span>
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
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={tier === "confirmed" ? "detail-value" : "detail-value font-normal"}>{formattedValue ?? "—"}</span>
        {showLowConfidence && <span className="text-xs text-[var(--color-ink-muted)]">Confidenza {pct}%</span>}
      </div>
      <div className="mt-0.5 flex items-center gap-1">
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
