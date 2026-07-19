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
  endpointBase,
  registryVerified = false,
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
  /** Radice dell'endpoint da usare al posto del default `/api/cases/${caseId}/fields`, per
   * riusare questa cella anche su EnforcementDeviceField (Tappa 6). */
  endpointBase?: string;
  /** true quando questo campo è stato confrontato con esito positivo col registro MIT
   * (Troncone C, §2.1.A) — nessun bottone "Conferma", solo un'etichetta di provenienza: nessun
   * umano ha agito, non va simulata una conferma che non è avvenuta. */
  registryVerified?: boolean;
}) {
  const base = endpointBase ?? `/api/cases/${caseId}/fields`;
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
          {tier === "middle" && registryVerified && (
            <Badge tone="info" icon={Check}>
              Verificato dal registro MIT
            </Badge>
          )}
          {/* "Conferma" solo sui campi che restano un'eccezione da rivedere (bassa confidenza,
           * conflitto — tier "problematic" con un valore presente): i campi già affidabili
           * (tier "middle", soglia di confidenza già superata o verificati dal registro MIT) non
           * mostrano più un bottone individuale — si confermano dal bottone di blocco del
           * pannello (Troncone C, §2.1). Mai "Conferma" su un valore assente (H8, P0 #1 di
           * docs/UX-AUDIT-2026-07.md): confermarlo fallirebbe sempre lato server. */}
          {!field.confirmedBy && field.value && field.needsHumanReview && (
            <ActionButton method="PATCH" url={`${base}/${fieldKey}`} body={{}} variant="secondary" size="sm">
              Conferma
            </ActionButton>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <FieldEditForm
          caseId={caseId}
          fieldKey={fieldKey}
          initialValue={field.value ?? ""}
          endpointBase={endpointBase}
          triggerLabel={!field.value ? "Inserisci dato" : undefined}
        />
        <FieldSourceInfo
          sourceType={field.sourceType}
          sourceMessageId={field.sourceMessageId}
          sourceAttachmentId={field.sourceAttachmentId}
        />
      </div>
    </div>
  );
}
