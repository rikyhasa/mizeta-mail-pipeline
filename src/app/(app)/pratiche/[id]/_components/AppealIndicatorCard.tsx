import { ShieldAlert } from "lucide-react";
import { WorkPanel } from "@/components/ui/WorkPanel";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/format";
import {
  APPEAL_DECISION_LABELS,
  APPEAL_DOCUMENTARY_STRENGTH_LABELS,
  APPEAL_ECONOMIC_CONVENIENCE_LABELS,
  APPEAL_INDICATION_LABELS,
} from "@/lib/i18n/labels";
import type { AppealIndicatorResult } from "@/lib/appeal-indicator/calculate";
import type { AppealDecisionKind } from "@/generated/prisma/enums";
import { AppealDecisionForm } from "./AppealDecisionForm";

const INDICATION_TONE: Record<AppealIndicatorResult["indication"], BadgeTone> = {
  CONSIDER_GDP_APPEAL: "info",
  CONSIDER_PREFETTO_APPEAL: "info",
  RELEVANT_BUT_UNECONOMICAL: "warning",
  NO_RELEVANT_ELEMENT: "neutral",
  DEADLINES_EXPIRED: "critical",
  INSUFFICIENT_DATA: "muted",
};

interface AppealDecisionData {
  decision: AppealDecisionKind;
  note: string | null;
  decidedByName: string | null;
  decidedAt: Date | null;
}

/**
 * Pannello "Indicatore ricorso" (docs/SPEC.md §10bis, docs/SPEC-AUTOVELOX-DRAFT.md §15.7): i
 * due assi sempre separati, mai un unico numero composito; scomposizione sempre visibile;
 * disclaimer obbligatorio e sempre presente (CLAUDE.md invariante 9) — mai una previsione di
 * esito o una probabilità di accoglimento.
 */
export function AppealIndicatorCard({
  caseId,
  result,
  decision,
}: {
  caseId: string;
  result: AppealIndicatorResult;
  decision: AppealDecisionData | null;
}) {
  return (
    <WorkPanel id="indicatore-ricorso" title="Indicatore ricorso">
      <div className="flex items-start gap-2 rounded-lg bg-[var(--color-surface-muted)] p-3 text-xs text-[var(--color-ink-muted)]">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Indicazione basata su dati documentali ed economici. Non costituisce parere legale né previsione sull&apos;esito di un
          ricorso.
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div>
          <span className="detail-label">Elementi documentali</span>
          <div className="mt-1">
            <Badge tone="neutral">{APPEAL_DOCUMENTARY_STRENGTH_LABELS[result.documentaryAxis]}</Badge>
          </div>
        </div>
        <div>
          <span className="detail-label">Convenienza economica</span>
          <div className="mt-1">
            <Badge tone="neutral">{result.economicAxis ? APPEAL_ECONOMIC_CONVENIENCE_LABELS[result.economicAxis] : "—"}</Badge>
          </div>
        </div>
        <div>
          <span className="detail-label">Indicazione</span>
          <div className="mt-1">
            <Badge tone={INDICATION_TONE[result.indication]}>{APPEAL_INDICATION_LABELS[result.indication]}</Badge>
          </div>
        </div>
      </div>

      {result.breakdown.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 text-sm text-[var(--color-ink)]">
          {result.breakdown.map((line, index) => (
            <li key={index}>· {line}</li>
          ))}
        </ul>
      )}

      <div className="mt-4 border-t border-[var(--color-border)] pt-3">
        <span className="detail-label">Decisione</span>
        <p className="mt-1 text-sm text-[var(--color-ink)]">
          {decision ? APPEAL_DECISION_LABELS[decision.decision] : APPEAL_DECISION_LABELS.NOT_DECIDED}
          {decision?.decidedByName && decision.decidedAt && (
            <span className="text-[var(--color-ink-muted)]"> — {decision.decidedByName}, {formatDateTime(decision.decidedAt)}</span>
          )}
        </p>
        {decision?.note && <p className="mt-1 text-xs text-[var(--color-ink-muted)]">Nota: {decision.note}</p>}
        <div className="mt-2">
          <AppealDecisionForm caseId={caseId} initialNote={decision?.note ?? null} />
        </div>
      </div>
    </WorkPanel>
  );
}
