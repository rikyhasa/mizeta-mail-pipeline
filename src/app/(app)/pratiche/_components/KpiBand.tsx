import type { DashboardKpis } from "@/lib/dashboard/queries";
import { formatCurrency } from "@/lib/format";

export function KpiBand({ kpis }: { kpis: DashboardKpis }) {
  const tiles = [
    { label: "Preventivi aperti", value: `${kpis.quotes.count}`, sub: formatCurrency(kpis.quotes.total) },
    { label: "Fatture fornitori in scadenza", value: formatCurrency(kpis.supplierInvoicesDueTotal), sub: null },
    { label: "Crediti scaduti", value: formatCurrency(kpis.overdueReceivablesTotal), sub: null },
    { label: "Reclami aperti", value: `${kpis.openClaims}`, sub: null },
    { label: "Multe aperte", value: `${kpis.openFines}`, sub: null },
    { label: "Classificazioni a bassa confidenza", value: `${kpis.lowConfidenceCount}`, sub: null },
  ];

  return (
    <section aria-label="Indicatori" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-lg border border-slate-200 bg-white px-3 py-3">
          <div className="text-lg font-semibold text-slate-900">{tile.value}</div>
          {tile.sub && <div className="text-xs text-slate-500">{tile.sub}</div>}
          <div className="mt-1 text-xs text-slate-500">{tile.label}</div>
        </div>
      ))}
    </section>
  );
}
