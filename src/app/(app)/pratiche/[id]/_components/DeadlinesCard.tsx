import { Card, CardHeader } from "@/components/ui/Card";
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

/** Elenco completo delle scadenze: la reference mostra solo la prossima (nel meta-grid
 * di "Sintesi operativa"), il target gestisce più scadenze per pratica — capacità più
 * avanzata, conservata come sezione a sé (Fase 8, docs/UI-PORTING-PLAN.md). */
export function DeadlinesCard({ deadlines }: { deadlines: DeadlineData[] }) {
  return (
    <Card padding="compact">
      <CardHeader title="Scadenze" />
      {deadlines.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Nessuna scadenza rilevata.</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {deadlines.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2">
              <span className="text-[var(--color-ink-muted)]">{DEADLINE_KIND_LABELS[d.kind]}:</span>
              <span className="font-medium text-[var(--color-ink)]">{formatDate(d.dueAt)}</span>
              {d.isCritical && <Badge tone="critical">Critica</Badge>}
              {d.resolvedAt && <span className="text-xs text-[var(--color-ink-muted)]">(risolta il {formatDate(d.resolvedAt)})</span>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
