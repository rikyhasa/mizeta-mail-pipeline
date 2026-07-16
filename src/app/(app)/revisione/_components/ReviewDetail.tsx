import Link from "next/link";
import { CategoryIcon } from "@/lib/i18n/category-icons";
import { CASE_CATEGORY_LABELS, CASE_RELATION_KIND_LABELS } from "@/lib/i18n/labels";
import { formatDate } from "@/lib/format";
import { ActionButton } from "@/components/ActionButton";
import { Badge, PriorityBadge } from "@/components/ui/Badge";
import { buttonClassName } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { WorkPanel } from "@/components/ui/WorkPanel";
import type { CaseCategory } from "@/generated/prisma/enums";
import type { QueueItem } from "./types";

/** Colonna destra della split-view: motivazioni complete, confronto duplicati, azioni — cosi
 * si lavora la coda senza uscire ed entrare in ogni pratica (Fase 7C). Riskin FASE 3: stesso
 * contenitore/tipografia del dettaglio pratica (WorkPanel, .detail-panel) al posto dei
 * `rounded-xl p-5` ad hoc — nessuna azione/query toccata. */
export function ReviewDetail({ item }: { item: QueueItem | null }) {
  if (!item) {
    return <EmptyState title="Seleziona un elemento" description="Scegli una voce dalla lista per vederne i dettagli." />;
  }

  if (item.itemType === "relation") {
    return (
      <WorkPanel
        title={CASE_RELATION_KIND_LABELS[item.relationKind]}
        description={item.reason ?? "Segnalato dalla pipeline"}
        action={
          item.confidence !== null ? (
            <span className="text-xs text-[var(--color-ink-muted)]">Confidenza {Math.round(item.confidence * 100)}%</span>
          ) : undefined
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CaseSummaryCard caseRef={item.source} />
          <CaseSummaryCard caseRef={item.target} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <ActionButton
            method="PATCH"
            url={`/api/cases/${item.caseId}/relations/${item.id}`}
            body={{ action: "confirm" }}
            variant="primary"
            size="sm"
          >
            Unisci le pratiche
          </ActionButton>
          <ActionButton
            method="PATCH"
            url={`/api/cases/${item.caseId}/relations/${item.id}`}
            body={{ action: "reject" }}
            variant="secondary"
            size="sm"
          >
            Mantieni separate
          </ActionButton>
        </div>
      </WorkPanel>
    );
  }

  return (
    <WorkPanel
      title={
        <Link href={`/pratiche/${item.id}`} className="hover:text-[var(--color-brand-dark)] hover:underline">
          {item.reference} — {item.title}
        </Link>
      }
      action={<PriorityBadge priority={item.priority} />}
      description={
        <span className="inline-flex items-center gap-1.5">
          <CategoryIcon category={item.category} className="h-3.5 w-3.5" />
          {CASE_CATEGORY_LABELS[item.category]} · creata il {formatDate(item.createdAt)}
        </span>
      }
    >
      <div className="flex flex-wrap gap-1.5">
        {item.reasons.map((reason, index) => (
          <Badge key={index} tone={reason.tone}>
            {reason.icon}
            {reason.text}
          </Badge>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={`/pratiche/${item.id}`} className={buttonClassName({ variant: "secondary", size: "sm" })}>
          Apri pratica
        </Link>
        <ActionButton method="PATCH" url={`/api/cases/${item.id}/review`} variant="tertiary" size="sm">
          Segna come verificata
        </ActionButton>
      </div>
    </WorkPanel>
  );
}

function CaseSummaryCard({ caseRef }: { caseRef: { id: string; reference: string; title: string; category: CaseCategory } }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-ink-muted)]">
        <CategoryIcon category={caseRef.category} className="h-3.5 w-3.5" />
        {CASE_CATEGORY_LABELS[caseRef.category]}
      </span>
      <Link
        href={`/pratiche/${caseRef.id}`}
        className="mt-1 block font-medium text-[var(--color-ink)] hover:text-[var(--color-brand-dark)] hover:underline"
      >
        {caseRef.reference} — {caseRef.title}
      </Link>
    </div>
  );
}
