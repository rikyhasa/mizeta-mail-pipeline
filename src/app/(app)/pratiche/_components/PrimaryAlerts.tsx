import Link from "next/link";
import type { ComponentType } from "react";
import { CalendarClock, AlertOctagon, Search } from "lucide-react";
import type { DashboardAlert } from "@/lib/dashboard/queries";
import { buildPraticheHref } from "@/lib/dashboard/href";

type Tone = "critical" | "warning";

const PRIMARY_CONFIG: Record<string, { label: string; icon: ComponentType<{ className?: string }>; tone: Tone }> = {
  oggi: { label: "Da fare oggi", icon: CalendarClock, tone: "critical" },
  overdue: { label: "Scadute", icon: AlertOctagon, tone: "critical" },
  needsReview: { label: "Da verificare", icon: Search, tone: "warning" },
};

const PRIMARY_ORDER = ["oggi", "overdue", "needsReview"] as const;

const TONE_ICON_CLASS: Record<Tone, string> = {
  critical: "text-[var(--color-critical)]",
  warning: "text-[var(--color-warning)]",
};

/**
 * I tre blocchi operativi dominanti della dashboard: rispondono da soli alla domanda
 * "cosa devo fare adesso?" senza competere con le metriche secondarie (Fase 7C).
 */
export function PrimaryAlerts({
  alerts,
  activeQuick,
  searchParams,
}: {
  alerts: DashboardAlert[];
  activeQuick?: string;
  searchParams: Record<string, string | undefined>;
}) {
  const byKey = new Map(alerts.map((a) => [a.key, a]));

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {PRIMARY_ORDER.map((key) => {
        const alert = byKey.get(key);
        if (!alert) return null;
        const config = PRIMARY_CONFIG[key];
        const Icon = config.icon;
        const isActive = activeQuick === key;
        const href = buildPraticheHref(searchParams, { quick: isActive ? null : key });

        return (
          <li key={key}>
            <Link
              href={href}
              aria-pressed={isActive}
              className={`flex h-full flex-col gap-4 rounded-xl border p-6 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] ${
                isActive
                  ? "border-[var(--color-brand)] bg-[color-mix(in_srgb,var(--color-brand)_6%,white)] shadow-sm"
                  : "border-[var(--color-border)] bg-white hover:border-[var(--color-brand)] hover:shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold tracking-wide text-[var(--color-ink-muted)] uppercase">
                  {config.label}
                </span>
                <Icon className={`h-6 w-6 ${TONE_ICON_CLASS[config.tone]}`} aria-hidden="true" />
              </div>
              <span className="text-5xl leading-none font-bold text-[var(--color-ink)]">{alert.count}</span>
              <span className="mt-auto text-sm font-medium text-[var(--color-brand-dark)]">
                {isActive ? "Filtro attivo — clic per rimuovere" : "Apri la lista →"}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
