import { Plus } from "lucide-react";
import { WorkPanel } from "@/components/ui/WorkPanel";
import { Disclosure } from "@/components/ui/Disclosure";
import { Badge } from "@/components/ui/Badge";
import { TASK_STATUS_LABELS } from "@/lib/i18n/labels";
import { formatDate } from "@/lib/format";
import { TaskForm } from "./TaskForm";
import type { TaskStatus } from "@/generated/prisma/enums";

interface TaskData {
  id: string;
  title: string;
  status: TaskStatus;
  dueAt: Date | null;
  assignedTo: { name: string } | null;
}

/** "Attività": senza equivalente nella reference (i suoi bottoni "Aggiungi attività" nella
 * colonna azioni non aprono una vera lista) — capacità del target, conservata come sezione. */
export function TasksCard({
  caseId,
  tasks,
  users,
}: {
  caseId: string;
  tasks: TaskData[];
  users: { id: string; name: string }[];
}) {
  return (
    <WorkPanel id="attivita" title="Attività">
      {tasks.length === 0 ? (
        <p className="mb-3 text-sm text-[var(--color-ink-muted)]">Nessuna attività.</p>
      ) : (
        <ul className="mb-3 flex flex-col gap-2 text-sm">
          {tasks.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-2">
              <span className="text-[var(--color-ink)]">{t.title}</span>
              <span className="text-xs text-[var(--color-ink-muted)]">{t.assignedTo?.name ?? "Non assegnata"}</span>
              {t.dueAt && <span className="text-xs text-[var(--color-ink-muted)]">entro {formatDate(t.dueAt)}</span>}
              <Badge tone="neutral">{TASK_STATUS_LABELS[t.status]}</Badge>
            </li>
          ))}
        </ul>
      )}
      <Disclosure
        summary={
          <span className="flex items-center gap-1.5">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Aggiungi attività
          </span>
        }
      >
        <TaskForm caseId={caseId} users={users} />
      </Disclosure>
    </WorkPanel>
  );
}
