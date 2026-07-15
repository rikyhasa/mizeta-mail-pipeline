import { Info } from "lucide-react";
import { FIELD_SOURCE_TYPE_LABELS } from "@/lib/i18n/labels";
import type { FieldSourceType } from "@/generated/prisma/enums";

/**
 * Fonte del dato in un popover discreto, non ripetuta per esteso sotto ogni campo
 * (FASE-7-REDESIGN.md — dati estratti).
 */
export function FieldSourceInfo({
  sourceType,
  sourceMessageId,
  sourceAttachmentId,
}: {
  sourceType: FieldSourceType | null;
  sourceMessageId: string | null;
  sourceAttachmentId: string | null;
}) {
  if (!sourceType && !sourceMessageId && !sourceAttachmentId) return null;

  return (
    <details className="group relative inline-block align-middle">
      <summary
        className="inline-flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-full text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] [&::-webkit-details-marker]:hidden"
        aria-label="Fonte del dato"
      >
        <Info className="h-4 w-4" aria-hidden="true" />
      </summary>
      <div className="absolute left-0 z-10 mt-1 w-64 rounded-lg border border-[var(--color-border)] bg-white p-3 text-xs shadow-md">
        {sourceType && <p className="text-[var(--color-ink-muted)]">Fonte: {FIELD_SOURCE_TYPE_LABELS[sourceType]}</p>}
        {sourceMessageId && (
          <a href={`#msg-${sourceMessageId}`} className="mt-1.5 block font-medium text-[var(--color-brand-dark)] hover:underline">
            Vedi email di origine
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
