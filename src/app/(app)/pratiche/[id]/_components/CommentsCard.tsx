import { MessageSquarePlus } from "lucide-react";
import { WorkPanel } from "./WorkPanel";
import { Disclosure } from "@/components/ui/Disclosure";
import { formatDateTime } from "@/lib/format";
import { CommentForm } from "./CommentForm";

interface CommentData {
  id: string;
  body: string;
  createdAt: Date;
  author: { name: string };
}

export function CommentsCard({ caseId, comments }: { caseId: string; comments: CommentData[] }) {
  return (
    <WorkPanel id="commenti" title="Commenti interni">
      {comments.length === 0 ? (
        <p className="mb-3 text-sm text-[var(--color-ink-muted)]">Nessun commento.</p>
      ) : (
        <ul className="mb-3 flex flex-col gap-2 text-sm">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg border border-[var(--color-border)] p-2">
              <div className="text-xs text-[var(--color-ink-muted)]">
                {c.author.name} — {formatDateTime(c.createdAt)}
              </div>
              <div className="text-[var(--color-ink)]">{c.body}</div>
            </li>
          ))}
        </ul>
      )}
      <Disclosure
        summary={
          <span className="flex items-center gap-1.5">
            <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
            Aggiungi commento
          </span>
        }
      >
        <CommentForm caseId={caseId} />
      </Disclosure>
    </WorkPanel>
  );
}
