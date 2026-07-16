import Link from "next/link";
import type { ComponentType } from "react";
import { AlertOctagon, AlertTriangle, CalendarClock, ClipboardList, Clock, Gavel, Search } from "lucide-react";
import type { DashboardAlert, DashboardQuickFilter } from "@/lib/dashboard/queries";
import { buildPraticheHref } from "@/lib/dashboard/href";

const ICON_BY_KEY: Record<string, ComponentType<{ className?: string }>> = {
  oggi: CalendarClock,
  overdue: AlertOctagon,
  dueSoon: Clock,
  quotesToRespond: ClipboardList,
  urgentClaims: AlertTriangle,
  urgentFines: Gavel,
  needsReview: Search,
};

/** "oggi" non ha un quick filter 1:1 (il conteggio combina scadenza odierna e priorità
 * critica): il link più vicino e reale è `dueToday`, non un filtro inesistente. */
const QUICK_FILTER_BY_KEY: Record<string, DashboardQuickFilter> = {
  oggi: "dueToday",
  overdue: "overdue",
  dueSoon: "dueSoon",
  quotesToRespond: "quotesToRespond",
  urgentClaims: "urgentClaims",
  urgentFines: "urgentFines",
  needsReview: "needsReview",
};

/**
 * Le 7 card KPI dominanti della dashboard ("cards-seven" nella reference,
 * prima e ultime due evidenziate con bordo superiore brand). A differenza
 * della reference (card statiche, nessun link reale) restano cliccabili verso
 * l'elenco filtrato: funzionalità già presente nel target, conservata (Fase 8,
 * docs/UI-PORTING-PLAN.md).
 */
export function DashboardKpiCards({ alerts }: { alerts: DashboardAlert[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {alerts.map((alert, index) => {
        const Icon = ICON_BY_KEY[alert.key] ?? ClipboardList;
        const isEdge = index < 2 || index > alerts.length - 3;
        const quick = QUICK_FILTER_BY_KEY[alert.key];
        const href = buildPraticheHref({}, { quick });

        return (
          <li key={alert.key}>
            <Link
              href={href}
              className={`flex h-full flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-white p-4 transition-colors hover:border-[var(--color-brand)] hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] ${
                isEdge ? "border-t-[3px] border-t-[var(--color-brand)]" : ""
              }`}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-surface-muted)] text-[var(--color-anthracite)]">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="text-2xl leading-none font-bold text-[var(--color-ink)]">{alert.count}</span>
              <span className="text-xs leading-snug text-[var(--color-ink-muted)]">{alert.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
