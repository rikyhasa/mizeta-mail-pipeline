import { ChevronDown } from "lucide-react";
import { EMAIL_DRAFT_STATUS_LABELS } from "@/lib/i18n/labels";
import { formatDateTime } from "@/lib/format";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { HighlightedText, type DraftData } from "./DraftCard";

const STATUS_BADGE_TONE: Record<DraftData["status"], BadgeTone> = {
  PENDING_APPROVAL: "warning",
  APPROVED: "success",
  DISCARDED: "muted",
};

/** Riga compatta per una bozza non attiva: cronologia in accordion invece di card ripetute. */
export function DraftHistoryRow({ index, draft }: { index: number; draft: DraftData }) {
  return (
    <details className="group rounded-lg border border-[var(--color-border)] bg-white">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 px-3 text-sm text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] [&::-webkit-details-marker]:hidden">
        <ChevronDown
          className="h-4 w-4 shrink-0 text-[var(--color-ink-muted)] transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
        <span className="font-medium">Bozza {index}</span>
        <Badge tone={STATUS_BADGE_TONE[draft.status]}>{EMAIL_DRAFT_STATUS_LABELS[draft.status]}</Badge>
        <span className="ml-auto text-xs text-[var(--color-ink-muted)]">{formatDateTime(draft.createdAt)}</span>
      </summary>
      <div className="flex flex-col gap-2 border-t border-[var(--color-border)] p-3 text-sm">
        <div className="text-xs text-[var(--color-ink-muted)]">
          A: {draft.toAddresses.length > 0 ? draft.toAddresses.join(", ") : "(destinatario da definire)"}
        </div>
        <div className="font-medium text-[var(--color-ink)]">
          <HighlightedText text={draft.subject} />
        </div>
        <div className="whitespace-pre-wrap text-[var(--color-ink)]">
          <HighlightedText text={draft.bodyText} />
        </div>
      </div>
    </details>
  );
}
