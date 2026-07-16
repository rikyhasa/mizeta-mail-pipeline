import { Card, CardHeader } from "@/components/ui/Card";
import { PriorityBadge } from "@/components/ui/Badge";
import { InlineSelect } from "@/components/InlineSelect";
import { formatDate } from "@/lib/format";
import type { CasePriority, CaseStatus } from "@/generated/prisma/enums";

/** "Sintesi operativa" (reference): sommario + priorità + griglia metadati. A
 * differenza della reference (campi statici), Stato e Responsabile restano
 * modificabili inline — funzionalità già presente nel target, conservata. */
export function SummaryCard({
  caseId,
  priority,
  summary,
  confidence,
  status,
  statusOptions,
  assignedToId,
  assigneeOptions,
  nextDeadlineAt,
  amountFormatted,
}: {
  caseId: string;
  priority: CasePriority;
  summary: string | null;
  confidence: number | null;
  status: CaseStatus;
  statusOptions: { value: string; label: string }[];
  assignedToId: string | null;
  assigneeOptions: { value: string; label: string }[];
  nextDeadlineAt: Date | null;
  amountFormatted: string;
}) {
  return (
    <Card padding="compact">
      <CardHeader title="Sintesi operativa" action={<PriorityBadge priority={priority} />} />
      {summary && <p className="text-sm text-[var(--color-ink-muted)]">{summary}</p>}
      {confidence !== null && (
        <p className="mt-1 text-xs text-[var(--color-ink-muted)]">Confidenza classificazione: {Math.round(confidence * 100)}%</p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-[var(--color-border)] pt-4 sm:grid-cols-4">
        <InlineSelect url={`/api/cases/${caseId}/status`} fieldName="status" value={status} options={statusOptions} label="Stato" />
        <InlineSelect
          url={`/api/cases/${caseId}/assign`}
          fieldName="assignedToId"
          value={assignedToId ?? ""}
          options={assigneeOptions}
          label="Responsabile"
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-[var(--color-ink)]">Scadenza</span>
          <div className="flex min-h-[44px] items-center text-sm font-medium text-[var(--color-ink)]">
            {nextDeadlineAt ? formatDate(nextDeadlineAt) : "Nessuna scadenza"}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-[var(--color-ink)]">Importo</span>
          <div className="flex min-h-[44px] items-center text-sm font-medium text-[var(--color-ink)]">{amountFormatted}</div>
        </div>
      </div>
    </Card>
  );
}
