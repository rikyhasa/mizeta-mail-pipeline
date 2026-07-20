import { Info } from "lucide-react";
import { buttonClassName } from "@/components/ui/Button";
import { formatDateTime } from "@/lib/format";
import { FIELD_SOURCE_TYPE_LABELS } from "@/lib/i18n/labels";
import type { FieldSourceType } from "@/generated/prisma/enums";

export interface FieldProvenanceData {
  sourceType: FieldSourceType | null;
  sourceMessageId: string | null;
  sourceAttachmentId: string | null;
  sourcePage: number | null;
  sourceExcerpt: string | null;
  confidence: number | null;
  needsHumanReview: boolean;
  confirmedBy: { name: string } | null;
  confirmedAt: Date | null;
}

/**
 * "Fonte del dato" (FASE 11, Livello 3): sostituisce l'ex FieldSourceInfo con lo stesso pattern
 * — `<details>` nativo, chiuso di default, nessun nuovo primitivo di collapse — ma con tutta la
 * provenienza già presente nello schema (pagina, estratto, confidenza, stato di revisione,
 * chi/quando ha confermato) e finora non mostrata. Identica per `CaseField` ed
 * `EnforcementDeviceField`, stessa forma verificata nello schema Prisma: nessun codice
 * specifico per l'autovelox, riusabile ovunque un campo estratto sia mostrato.
 * "Metodo di estrazione": non esiste un campo dedicato nello schema — `sourceType` è il proxy
 * più vicino (regex/LLM/manuale non sono distinti). Annotato come limite noto, non colmato qui.
 */
export function FieldProvenancePanel({
  sourceType,
  sourceMessageId,
  sourceAttachmentId,
  sourcePage,
  sourceExcerpt,
  confidence,
  needsHumanReview,
  confirmedBy,
  confirmedAt,
}: FieldProvenanceData) {
  if (!sourceType && !sourceMessageId && !sourceAttachmentId) return null;

  const confidencePct = confidence !== null ? Math.round(confidence * 100) : null;

  return (
    <details className="group relative inline-block align-middle">
      <summary
        className={`${buttonClassName({ variant: "tertiary", size: "sm" })} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
        aria-label="Vedi la fonte del dato"
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
        Fonte
      </summary>
      <div className="absolute left-0 z-10 mt-1 w-72 rounded-lg border border-[var(--color-border)] bg-white p-3 text-xs shadow-md">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {sourceType && (
            <div>
              <dt className="detail-label">Fonte</dt>
              <dd className="text-[var(--color-ink)]">{FIELD_SOURCE_TYPE_LABELS[sourceType]}</dd>
            </div>
          )}
          {sourcePage !== null && (
            <div>
              <dt className="detail-label">Pagina</dt>
              <dd className="text-[var(--color-ink)]">{sourcePage}</dd>
            </div>
          )}
          {confidencePct !== null && (
            <div>
              <dt className="detail-label">Confidenza</dt>
              <dd className="text-[var(--color-ink)]">{confidencePct}%</dd>
            </div>
          )}
          <div>
            <dt className="detail-label">Revisione</dt>
            <dd className="text-[var(--color-ink)]">{needsHumanReview ? "Da rivedere" : "Verificato"}</dd>
          </div>
        </dl>

        {confirmedBy && (
          <p className="mt-2 text-[var(--color-ink-muted)]">
            Confermato da {confirmedBy.name}
            {confirmedAt && <> · {formatDateTime(confirmedAt)}</>}
          </p>
        )}

        {sourceExcerpt && (
          <p className="mt-2 rounded p-2 leading-snug text-[var(--color-ink)]" style={{ background: "var(--color-warning-soft)" }}>
            &ldquo;{sourceExcerpt}&rdquo;
          </p>
        )}

        {sourceMessageId && (
          <a href={`#msg-${sourceMessageId}`} className="mt-2 block font-medium text-[var(--color-brand-dark)] hover:underline">
            Apri al punto — email di origine
          </a>
        )}
        {sourceAttachmentId && (
          <a
            href={`/api/attachments/${sourceAttachmentId}`}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 block font-medium text-[var(--color-brand-dark)] hover:underline"
          >
            Apri allegato di origine
          </a>
        )}
      </div>
    </details>
  );
}
