import { StatsStrip, type StatsStripItem } from "@/components/ui/StatsStrip";
import type { DashboardKpis } from "@/lib/dashboard/queries";
import { buildPraticheHref } from "@/lib/dashboard/href";
import { formatCurrency } from "@/lib/format";

/**
 * Fascia "Quadro operativo": le 7 celle secondarie della reference, qui
 * calcolate da `getKpis()` — nessuna nuova query Prisma, solo ricomposizione
 * (Fase 8, docs/UI-PORTING-PLAN.md). Link presenti solo dove riproducono
 * esattamente il valore mostrato: "Reclami aperti"/"Multe aperte" non hanno
 * un filtro rapido equivalente (il filtro per categoria mostrerebbe anche le
 * pratiche chiuse), quindi restano senza link piuttosto che rimandare a un
 * risultato diverso da quanto dichiarato.
 */
export function DashboardSecondaryStats({ kpis }: { kpis: DashboardKpis }) {
  const items: StatsStripItem[] = [
    {
      key: "quotesCount",
      value: kpis.quotes.count,
      label: "Preventivi aperti",
      href: buildPraticheHref({}, { quick: "quotesToRespond" }),
    },
    { key: "quotesTotal", value: formatCurrency(kpis.quotes.total), label: "Valore preventivi" },
    { key: "supplierInvoicesDue", value: formatCurrency(kpis.supplierInvoicesDueTotal), label: "Fatture fornitori in scadenza" },
    { key: "overdueReceivables", value: formatCurrency(kpis.overdueReceivablesTotal), label: "Crediti scaduti" },
    { key: "openClaims", value: kpis.openClaims, label: "Reclami aperti" },
    { key: "openFines", value: kpis.openFines, label: "Multe aperte" },
    {
      key: "lowConfidence",
      value: kpis.lowConfidenceCount,
      label: "Classificazioni a bassa confidenza",
      href: buildPraticheHref({}, { lowConfidence: "1" }),
    },
  ];

  return <StatsStrip items={items} />;
}
