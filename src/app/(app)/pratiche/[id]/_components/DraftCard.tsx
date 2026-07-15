import { EMAIL_DRAFT_STATUS_LABELS } from "@/lib/i18n/labels";
import { formatDateTime } from "@/lib/format";
import { ActionButton } from "@/components/ActionButton";

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

const STATUS_BADGE_CLASSES: Record<DraftData["status"], string> = {
  PENDING_APPROVAL: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  DISCARDED: "bg-slate-100 text-slate-500",
};

export function DraftCard({ caseId, draft }: { caseId: string; draft: DraftData }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`inline-flex w-fit items-center rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[draft.status]}`}>
          {EMAIL_DRAFT_STATUS_LABELS[draft.status]}
        </span>
        <span className="text-xs text-slate-400">Generata il {formatDateTime(draft.createdAt)}</span>
      </div>
      <div className="text-xs text-slate-500">A: {draft.toAddresses.length > 0 ? draft.toAddresses.join(", ") : "(destinatario da definire)"}</div>
      <div className="text-sm font-medium text-slate-900">
        <HighlightedText text={draft.subject} />
      </div>
      <div className="whitespace-pre-wrap text-sm text-slate-700">
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
            className="rounded bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-700"
          >
            Approva
          </ActionButton>
          <ActionButton
            method="PATCH"
            url={`/api/cases/${caseId}/drafts/${draft.id}`}
            body={{ action: "discard" }}
            confirmMessage="Scartare questa bozza?"
            className="rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50"
          >
            Scarta
          </ActionButton>
        </div>
      )}
    </div>
  );
}
