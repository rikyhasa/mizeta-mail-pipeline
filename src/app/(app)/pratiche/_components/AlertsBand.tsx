import Link from "next/link";
import type { ComponentType } from "react";
import { CalendarClock, AlertOctagon, Clock, ClipboardList, AlertTriangle, Gavel, Search } from "lucide-react";
import type { DashboardAlert } from "@/lib/dashboard/queries";
import { buildPraticheHref } from "@/lib/dashboard/href";
import { formatCurrency } from "@/lib/format";

type Tone = "critical" | "warning" | "neutral";

const ALERT_CONFIG: Record<string, { icon: ComponentType<{ className?: string }>; tone: Tone }> = {
  oggi: { icon: CalendarClock, tone: "critical" },
  overdue: { icon: AlertOctagon, tone: "critical" },
  dueSoon: { icon: Clock, tone: "warning" },
  quotesToRespond: { icon: ClipboardList, tone: "neutral" },
  urgentClaims: { icon: AlertTriangle, tone: "warning" },
  urgentFines: { icon: Gavel, tone: "warning" },
  needsReview: { icon: Search, tone: "warning" },
};

const TONE_ICON_CLASS: Record<Tone, string> = {
  critical: "text-red-600",
  warning: "text-amber-600",
  neutral: "text-[var(--color-ink-muted)]",
};

/**
 * "Da fare oggi": gli indicatori realmente operativi, in evidenza in cima alla dashboard.
 * L'arancione di brand è usato solo per lo stato di selezione (filtro attivo), mai per l'urgenza.
 */
export function AlertsBand({
  alerts,
  activeQuick,
  searchParams,
  quotesTotal,
}: {
  alerts: DashboardAlert[];
  activeQuick?: string;
  searchParams: Record<string, string | undefined>;
  quotesTotal?: number;
}) {
  return (
    <section aria-label="Da fare oggi">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-[var(--color-ink-muted)] uppercase">
        Da fare oggi
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {alerts.map((alert) => {
          const isActive = activeQuick === alert.key;
          const config = ALERT_CONFIG[alert.key] ?? { icon: ClipboardList, tone: "neutral" as Tone };
          const Icon = config.icon;
          const href = buildPraticheHref(searchParams, { quick: isActive ? null : alert.key });
          const subLabel = alert.key === "quotesToRespond" && quotesTotal ? formatCurrency(quotesTotal) : null;

          return (
            <li key={alert.key}>
              <Link
                href={href}
                aria-pressed={isActive}
                className={`flex h-full min-h-[124px] flex-col gap-2 rounded-xl border p-4 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] ${
                  isActive
                    ? "border-[var(--color-brand)] bg-[color-mix(in_srgb,var(--color-brand)_8%,white)] shadow-sm"
                    : "border-[var(--color-border)] bg-white hover:border-[var(--color-brand)] hover:shadow-sm"
                }`}
              >
                <Icon className={`h-5 w-5 ${TONE_ICON_CLASS[config.tone]}`} aria-hidden="true" />
                <span className="text-3xl font-semibold text-[var(--color-ink)]">{alert.count}</span>
                <span className="text-sm text-[var(--color-ink-muted)]">{alert.label}</span>
                {subLabel && <span className="text-xs text-[var(--color-ink-muted)]">{subLabel} totali</span>}
                {isActive && (
                  <span className="mt-auto text-xs font-medium text-[var(--color-brand-dark)]">
                    Filtro attivo — clic per rimuovere
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
