import { Info } from "lucide-react";
import { buttonClassName } from "@/components/ui/Button";
import { FIELD_SOURCE_TYPE_LABELS } from "@/lib/i18n/labels";
import type { FieldSourceType } from "@/generated/prisma/enums";

/**
 * Fonte del dato in un popover discreto, non ripetuta per esteso sotto ogni campo
 * (FASE-7-REDESIGN.md — dati estratti). Trigger con etichetta testuale, non solo icona
 * (A2/nota di framing FASE E: l'affordance di provenienza c'era già ma restava scoperta solo
 * da chi già sapeva cercarla dietro un'icona di 16px) — per audit veloce, "vai alla fonte" deve
 * essere leggibile a colpo d'occhio quanto "Conferma" o "Modifica".
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
        className={`${buttonClassName({ variant: "tertiary", size: "sm" })} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
        aria-label="Vedi la fonte del dato"
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
        Fonte
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
