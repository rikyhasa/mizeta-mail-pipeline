import type { DashboardKpis } from "@/lib/dashboard/queries";
import { formatCurrency } from "@/lib/format";
import { Disclosure } from "@/components/ui/Disclosure";

/**
 * Indicatori informativi, non immediatamente operativi: sezione secondaria e comprimibile
 * per non competere visivamente con "Da fare oggi" (FASE-7-REDESIGN.md).
 * "Preventivi aperti", "Reclami aperti" e "Multe aperte" sono stati rimossi qui perché
 * ridondanti con gli avvisi urgenti già mostrati sopra.
 */
export function KpiBand({ kpis }: { kpis: DashboardKpis }) {
  const tiles = [
    { label: "Fatture fornitori in scadenza", value: formatCurrency(kpis.supplierInvoicesDueTotal) },
    { label: "Crediti scaduti", value: formatCurrency(kpis.overdueReceivablesTotal) },
    { label: "Classificazioni a bassa confidenza", value: `${kpis.lowConfidenceCount}` },
  ];

  return (
    <section aria-label="Panoramica">
      <Disclosure summary="Panoramica">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tiles.map((tile) => (
            <div key={tile.label} className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-3">
              <div className="text-base font-semibold text-[var(--color-ink)]">{tile.value}</div>
              <div className="mt-1 text-xs text-[var(--color-ink-muted)]">{tile.label}</div>
            </div>
          ))}
        </div>
      </Disclosure>
    </section>
  );
}
