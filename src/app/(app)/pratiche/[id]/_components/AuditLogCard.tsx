import { Clock3 } from "lucide-react";
import { WorkPanel } from "./WorkPanel";
import { Disclosure } from "@/components/ui/Disclosure";
import { AUDIT_ACTION_LABELS } from "@/lib/i18n/labels";
import { formatDateTime, formatTime } from "@/lib/format";
import type { AuditAction } from "@/generated/prisma/enums";

interface AuditLogData {
  id: string;
  createdAt: Date;
  action: AuditAction;
  actor: { name: string } | null;
}

interface DisplayRow {
  key: string;
  title: string;
  copy: string;
  sortAt: Date;
}

const VISIBLE_COUNT = 5;

/** Gli "Accesso alla pratica" (CASE_VIEWED) ripetuti si accumulano rapidamente e non sono
 * eventi individualmente significativi — raggruppati in un'unica riga (FASE 8B, iterazione
 * 4), il resto (max 5 righe "significative") resta come nella reference; oltre le 5, dietro
 * "Mostra tutto" (nessuna nuova query: sempre entro le 30 già caricate da page.tsx). */
function buildDisplayRows(logs: AuditLogData[]): DisplayRow[] {
  const viewed = logs.filter((l) => l.action === "CASE_VIEWED");
  const others = logs.filter((l) => l.action !== "CASE_VIEWED");

  const rows: DisplayRow[] = others.map((log) => ({
    key: log.id,
    title: AUDIT_ACTION_LABELS[log.action],
    copy: `${log.actor ? log.actor.name : "Sistema"} · ${formatDateTime(log.createdAt)}`,
    sortAt: log.createdAt,
  }));

  if (viewed.length > 0) {
    const lastViewed = viewed[0]!.createdAt; // logs arriva già ordinato desc da page.tsx
    rows.push({
      key: "case-viewed-group",
      title: viewed.length === 1 ? "Accesso alla pratica" : `${viewed.length} accessi alla pratica`,
      copy: `Ultimo alle ${formatTime(lastViewed)}`,
      sortAt: lastViewed,
    });
  }

  return rows.sort((a, b) => b.sortAt.getTime() - a.sortAt.getTime());
}

function TimelineRow({ row }: { row: DisplayRow }) {
  return (
    <div className="detail-timeline-item">
      <div className="detail-timeline-dot">
        <Clock3 className="h-3.5 w-3.5 text-[var(--color-ink-muted)]" aria-hidden="true" />
      </div>
      <div>
        <div className="detail-timeline-title">{row.title}</div>
        <div className="detail-timeline-copy">{row.copy}</div>
      </div>
    </div>
  );
}

export function AuditLogCard({ logs }: { logs: AuditLogData[] }) {
  if (logs.length === 0) {
    return (
      <WorkPanel id="registro" title="Registro attività">
        <p className="text-sm text-[var(--color-ink-muted)]">Nessuna voce registrata.</p>
      </WorkPanel>
    );
  }

  const rows = buildDisplayRows(logs);
  const visible = rows.slice(0, VISIBLE_COUNT);
  const rest = rows.slice(VISIBLE_COUNT);

  return (
    <WorkPanel id="registro" title="Registro attività">
      <div className="detail-timeline">
        {visible.map((row) => (
          <TimelineRow key={row.key} row={row} />
        ))}
      </div>
      {rest.length > 0 && (
        <Disclosure summary={`Mostra tutto (${rows.length})`} className="mt-1">
          <div className="detail-timeline">
            {rest.map((row) => (
              <TimelineRow key={row.key} row={row} />
            ))}
          </div>
        </Disclosure>
      )}
    </WorkPanel>
  );
}
