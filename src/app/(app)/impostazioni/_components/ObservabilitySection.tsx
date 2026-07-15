import { formatCurrency } from "@/lib/format";
import type { ObservabilitySnapshot } from "@/lib/observability/metrics";

/** Riepilogo compatto coda job + costo/errori AI (SPEC.md §17). Il dettaglio completo, con
 * metadati più estesi, resta disponibile via `/api/observability` (ADMIN). */
export function ObservabilitySection({ snapshot }: { snapshot: ObservabilitySnapshot }) {
  const { jobs, aiRuns, manualCorrections } = snapshot;

  return (
    <section aria-label="Osservabilità" className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Osservabilità</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="In attesa" value={jobs.PENDING} />
        <Stat label="In corso" value={jobs.RUNNING} />
        <Stat label="Completati" value={jobs.SUCCEEDED} />
        <Stat label="Falliti (in retry)" value={jobs.FAILED} />
        <Stat label="Scartati (dead-letter)" value={jobs.DEAD_LETTER} tone={jobs.DEAD_LETTER > 0 ? "warn" : undefined} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded border border-slate-100 p-3 text-xs text-slate-600">
          <div className="mb-1 font-medium text-slate-800">Chiamate AI — ultime 24h</div>
          <div>
            {aiRuns.last24h.succeeded} riuscite · {aiRuns.last24h.failed} fallite · {formatCurrency(aiRuns.last24h.costUsd)} ·{" "}
            {aiRuns.last24h.inputTokens + aiRuns.last24h.outputTokens} token
          </div>
        </div>
        <div className="rounded border border-slate-100 p-3 text-xs text-slate-600">
          <div className="mb-1 font-medium text-slate-800">Chiamate AI — ultimi 7 giorni</div>
          <div>
            {aiRuns.last7d.succeeded} riuscite · {aiRuns.last7d.failed} fallite · {formatCurrency(aiRuns.last7d.costUsd)} ·{" "}
            {aiRuns.last7d.inputTokens + aiRuns.last7d.outputTokens} token
          </div>
        </div>
        <div className="rounded border border-slate-100 p-3 text-xs text-slate-600">
          <div className="mb-1 font-medium text-slate-800">Correzioni manuali — ultime 24h</div>
          <div>
            {manualCorrections.last24h.fieldsUpdated} campi corretti · {manualCorrections.last24h.fieldsConfirmed} campi confermati
          </div>
        </div>
        <div className="rounded border border-slate-100 p-3 text-xs text-slate-600">
          <div className="mb-1 font-medium text-slate-800">Correzioni manuali — ultimi 7 giorni</div>
          <div>
            {manualCorrections.last7d.fieldsUpdated} campi corretti · {manualCorrections.last7d.fieldsConfirmed} campi confermati
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div className="rounded border border-slate-100 p-2 text-center">
      <div className={`text-lg font-semibold ${tone === "warn" && value > 0 ? "text-amber-700" : "text-slate-900"}`}>{value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  );
}
