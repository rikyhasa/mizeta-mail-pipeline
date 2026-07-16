import { Badge } from "@/components/ui/Badge";
import { DEADLINE_KIND_LABELS } from "@/lib/i18n/labels";
import { formatDate } from "@/lib/format";
import type { DeadlineKind } from "@/generated/prisma/enums";

interface DeadlineData {
  id: string;
  kind: DeadlineKind;
  dueAt: Date;
  isCritical: boolean;
  resolvedAt: Date | null;
}

/** Scadenze oltre la principale (già integrata nel meta-grid di SummaryCard): sostituisce
 * DeadlinesCard (FASE 8B, problema #2 — "Scadenze" non deve occupare una card intera per
 * una sola riga). Riga compatta, non renderizzata se non ci sono altre scadenze. */
export function DeadlinesStrip({ deadlines }: { deadlines: DeadlineData[] }) {
  if (deadlines.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-ink-muted)]">
      {deadlines.map((d) => (
        <li key={d.id} className="flex items-center gap-1.5">
          {DEADLINE_KIND_LABELS[d.kind]}: <span className="font-medium text-[var(--color-ink)]">{formatDate(d.dueAt)}</span>
          {d.isCritical && !d.resolvedAt && <Badge tone="critical">Critica</Badge>}
          {d.resolvedAt && <span>(risolta il {formatDate(d.resolvedAt)})</span>}
        </li>
      ))}
    </ul>
  );
}
