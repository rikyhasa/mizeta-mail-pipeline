import { StatsStrip, type StatsStripItem } from "@/components/ui/StatsStrip";
import type { DashboardAlert, DashboardKpis } from "@/lib/dashboard/queries";
import { buildPraticheHref } from "@/lib/dashboard/href";
import { formatCurrency } from "@/lib/format";

const ALERT_LABELS: Record<string, string> = {
  dueSoon: "Scadenze prossimi 7 giorni",
  quotesToRespond: "Preventivi da rispondere",
  urgentClaims: "Reclami urgenti",
  urgentFines: "Multe urgenti",
};

const SECONDARY_ALERT_ORDER = ["dueSoon", "quotesToRespond", "urgentClaims", "urgentFines"] as const;

/**
 * Fascia unica per le metriche secondarie della dashboard: fonde ciò che prima erano
 * gli avvisi "Da fare oggi" non dominanti e la sezione "Panoramica" (rimossa, non solo
 * rinominata — Fase 7C).
 */
export function DashboardStatsStrip({
  alerts,
  kpis,
  searchParams,
}: {
  alerts: DashboardAlert[];
  kpis: DashboardKpis;
  searchParams: Record<string, string | undefined>;
}) {
  const alertByKey = new Map(alerts.map((a) => [a.key, a]));

  const items: StatsStripItem[] = [
    ...SECONDARY_ALERT_ORDER.flatMap((key): StatsStripItem[] => {
      const alert = alertByKey.get(key);
      if (!alert) return [];
      return [
        {
          key,
          value: alert.count,
          label: ALERT_LABELS[key] ?? alert.label,
          href: buildPraticheHref(searchParams, { quick: key }),
        },
      ];
    }),
    {
      key: "supplierInvoicesDue",
      value: formatCurrency(kpis.supplierInvoicesDueTotal),
      label: "Fatture fornitori in scadenza",
    },
    {
      key: "overdueReceivables",
      value: formatCurrency(kpis.overdueReceivablesTotal),
      label: "Crediti scaduti",
    },
    {
      key: "lowConfidence",
      value: kpis.lowConfidenceCount,
      label: "Classificazioni a bassa confidenza",
      href: buildPraticheHref(searchParams, { lowConfidence: "1" }),
    },
  ];

  return <StatsStrip items={items} />;
}
