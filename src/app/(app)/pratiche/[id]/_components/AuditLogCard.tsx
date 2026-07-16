import { Clock3 } from "lucide-react";
import { WorkPanel } from "./WorkPanel";
import { AUDIT_ACTION_LABELS } from "@/lib/i18n/labels";
import { formatDateTime } from "@/lib/format";
import type { AuditAction } from "@/generated/prisma/enums";

interface AuditLogData {
  id: string;
  createdAt: Date;
  action: AuditAction;
  actor: { name: string } | null;
}

/** Stesso trattamento a timeline di EmailTimelineCard (FASE 8B) — la reference riusa un solo
 * pattern ".timeline" per Cronologia email e Registro attività, qui replicato con
 * .detail-timeline*. */
export function AuditLogCard({ logs }: { logs: AuditLogData[] }) {
  return (
    <WorkPanel id="registro" title="Registro attività">
      {logs.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Nessuna voce registrata.</p>
      ) : (
        <div className="detail-timeline">
          {logs.map((log) => (
            <div key={log.id} className="detail-timeline-item">
              <div className="detail-timeline-dot">
                <Clock3 className="h-3.5 w-3.5 text-[var(--color-ink-muted)]" aria-hidden="true" />
              </div>
              <div>
                <div className="detail-timeline-title">{AUDIT_ACTION_LABELS[log.action]}</div>
                <div className="detail-timeline-copy">
                  {log.actor ? log.actor.name : "Sistema"} · {formatDateTime(log.createdAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </WorkPanel>
  );
}
