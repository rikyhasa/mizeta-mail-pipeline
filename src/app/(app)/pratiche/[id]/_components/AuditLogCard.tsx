import { Card, CardHeader } from "@/components/ui/Card";
import { AUDIT_ACTION_LABELS } from "@/lib/i18n/labels";
import { formatDateTime } from "@/lib/format";
import type { AuditAction } from "@/generated/prisma/enums";

interface AuditLogData {
  id: string;
  createdAt: Date;
  action: AuditAction;
  actor: { name: string } | null;
}

export function AuditLogCard({ logs }: { logs: AuditLogData[] }) {
  return (
    <Card padding="compact" id="registro" className="scroll-mt-24">
      <CardHeader title="Registro attività" />
      {logs.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Nessuna voce registrata.</p>
      ) : (
        <ul className="flex flex-col gap-1.5 text-xs text-[var(--color-ink-muted)]">
          {logs.map((log) => (
            <li key={log.id}>
              {formatDateTime(log.createdAt)} — {AUDIT_ACTION_LABELS[log.action]} {log.actor ? `(${log.actor.name})` : "(sistema)"}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
