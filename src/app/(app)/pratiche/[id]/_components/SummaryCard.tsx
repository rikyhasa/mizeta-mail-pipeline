import { WorkPanel } from "./WorkPanel";
import { PriorityBadge } from "@/components/ui/Badge";
import { EditableMetaField } from "./EditableMetaField";
import { DeadlinesStrip } from "./DeadlinesStrip";
import { formatDate } from "@/lib/format";
import type { CasePriority, CaseStatus, DeadlineKind } from "@/generated/prisma/enums";

interface DeadlineData {
  id: string;
  kind: DeadlineKind;
  dueAt: Date;
  isCritical: boolean;
  resolvedAt: Date | null;
}

/** "Sintesi operativa" (reference): sommario + priorità + meta-grid. Stato e Responsabile
 * restano modificabili (click per rivelare l'InlineSelect esistente, FASE 8B problema #11 —
 * la reference li mostra statici, qui la modifica inline è mantenuta perché già presente nel
 * target). La scadenza principale è integrata qui; le altre scadenze (se presenti) in una
 * striscia compatta sotto, non più in una card dedicata. */
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
  otherDeadlines,
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
  otherDeadlines: DeadlineData[];
  amountFormatted: string;
}) {
  return (
    <WorkPanel id="sintesi" title="Sintesi operativa" action={<PriorityBadge priority={priority} />}>
      {summary && <p className="detail-summary-text">{summary}</p>}
      {confidence !== null && (
        <p className="mt-1 text-xs text-[var(--color-ink-muted)]">Confidenza classificazione: {Math.round(confidence * 100)}%</p>
      )}
      <div className="detail-meta-grid">
        <EditableMetaField url={`/api/cases/${caseId}/status`} fieldName="status" value={status} options={statusOptions} label="Stato" />
        <EditableMetaField
          url={`/api/cases/${caseId}/assign`}
          fieldName="assignedToId"
          value={assignedToId ?? ""}
          options={assigneeOptions}
          label="Responsabile"
        />
        <div>
          <span className="detail-label">Scadenza</span>
          <div className="detail-value">{nextDeadlineAt ? formatDate(nextDeadlineAt) : "Nessuna scadenza"}</div>
        </div>
        <div>
          <span className="detail-label">Importo</span>
          <div className="detail-value">{amountFormatted}</div>
        </div>
      </div>
      <DeadlinesStrip deadlines={otherDeadlines} />
    </WorkPanel>
  );
}
