import { AlertTriangle } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { CASE_RELATION_KIND_LABELS } from "@/lib/i18n/labels";
import type { RelationSummary } from "./relation-types";

export function AnomaliesCard({
  anomalyReason,
  securityFlags,
  pendingRelations,
}: {
  anomalyReason: string | null;
  securityFlags: string[];
  pendingRelations: RelationSummary[];
}) {
  const isEmpty = !anomalyReason && securityFlags.length === 0 && pendingRelations.length === 0;

  return (
    <Card padding="compact" id="anomalie" className="scroll-mt-24">
      <CardHeader title="Anomalie e controlli" />
      {isEmpty ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Nessuna anomalia rilevata.</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm text-[var(--color-ink)]">
          {anomalyReason && (
            <li className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
              Fattura: {anomalyReason}
            </li>
          )}
          {securityFlags.map((flag) => (
            <li key={flag} className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
              Segnale di sicurezza rilevato nel contenuto email: <span className="font-mono text-xs">{flag}</span>
            </li>
          ))}
          {pendingRelations.map((r) => (
            <li key={r.id} className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
              {CASE_RELATION_KIND_LABELS[r.kind]} con {r.reference} — {r.title} (confidenza{" "}
              {r.confidence !== null ? `${Math.round(r.confidence * 100)}%` : "n/d"})
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
