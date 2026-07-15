import { EMAIL_DRAFT_STATUS_LABELS } from "@/lib/i18n/labels";
import { formatDateTime } from "@/lib/format";
import { ActionButton } from "@/components/ActionButton";
import { Badge, type BadgeTone } from "@/components/ui/Badge";

const PLACEHOLDER_PATTERN = /(\[\[DA COMPLETARE:[^\]]+\]\])/g;

function HighlightedText({ text }: { text: string }) {
  const parts = text.split(PLACEHOLDER_PATTERN);
  return (
    <>
      {parts.map((part, i) =>
        PLACEHOLDER_PATTERN.test(part) ? (
          <mark key={i} className="bg-amber-200 px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

interface DraftData {
  id: string;
  subject: string;
  bodyText: string;
  toAddresses: string[];
  placeholders: string[];
  status: "PENDING_APPROVAL" | "APPROVED" | "DISCARDED";
  createdAt: string | Date;
  approvedAt: string | Date | null;
}

const STATUS_BADGE_TONE: Record<DraftData["status"], BadgeTone> = {
  PENDING_APPROVAL: "warning",
  APPROVED: "success",
  DISCARDED: "muted",
};

export function DraftCard({ caseId, draft }: { caseId: string; draft: DraftData }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge tone={STATUS_BADGE_TONE[draft.status]}>{EMAIL_DRAFT_STATUS_LABELS[draft.status]}</Badge>
        <span className="text-xs text-[var(--color-ink-muted)]">Generata il {formatDateTime(draft.createdAt)}</span>
      </div>
      <div className="text-xs text-[var(--color-ink-muted)]">
        A: {draft.toAddresses.length > 0 ? draft.toAddresses.join(", ") : "(destinatario da definire)"}
      </div>
      <div className="text-sm font-medium text-[var(--color-ink)]">
        <HighlightedText text={draft.subject} />
      </div>
      <div className="text-sm whitespace-pre-wrap text-[var(--color-ink)]">
        <HighlightedText text={draft.bodyText} />
      </div>
      {draft.placeholders.length > 0 && (
        <p className="text-xs text-amber-700">Dati da completare prima dell&apos;approvazione: {draft.placeholders.join(", ")}.</p>
      )}
      {draft.status === "PENDING_APPROVAL" && (
        <div className="flex gap-2 pt-1">
          <ActionButton
            method="PATCH"
            url={`/api/cases/${caseId}/drafts/${draft.id}`}
            body={{ action: "approve" }}
            confirmMessage="Confermi l'approvazione di questa bozza? La bozza resta comunque non inviata: nell'MVP l'invio non è previsto."
            variant="primary"
            size="sm"
          >
            Approva
          </ActionButton>
          <ActionButton
            method="PATCH"
            url={`/api/cases/${caseId}/drafts/${draft.id}`}
            body={{ action: "discard" }}
            confirmMessage="Scartare questa bozza?"
            variant="secondary"
            size="sm"
          >
            Scarta
          </ActionButton>
        </div>
      )}
    </div>
  );
}
