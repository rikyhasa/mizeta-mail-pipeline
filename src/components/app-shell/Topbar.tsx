import { Menu, Search } from "lucide-react";
import type { ProviderStatusSummary, ProviderStatusTone } from "@/lib/observability/provider-status";

const TONE_PILL_CLASSES: Record<ProviderStatusTone, string> = {
  mock: "bg-[color-mix(in_srgb,var(--color-forest)_14%,white)] text-[var(--color-forest)]",
  connected: "bg-[color-mix(in_srgb,var(--color-forest)_14%,white)] text-[var(--color-forest)]",
  attention: "bg-[color-mix(in_srgb,var(--color-warning)_16%,white)] text-[var(--color-warning)]",
  unavailable: "bg-slate-100 text-slate-500",
};

const TONE_DOT_CLASSES: Record<ProviderStatusTone, string> = {
  mock: "bg-[var(--color-forest)]",
  connected: "bg-[var(--color-forest)]",
  attention: "bg-[var(--color-warning)]",
  unavailable: "bg-slate-400",
};

/**
 * Topbar client-only per il drawer mobile (`onOpenDrawer`); ricerca globale come
 * form GET reale verso `/pratiche` (riusa il campo `q` già esistente in
 * `getFilteredCases`, nessun risultato simulato). Il campo non è precompilato
 * col valore corrente (evita di richiedere `useSearchParams`/Suspense in un
 * componente montato su ogni pagina — vedi docs/UI-PORTING-PLAN.md).
 */
export function Topbar({
  providerStatus,
  onOpenDrawer,
}: {
  providerStatus: ProviderStatusSummary;
  onOpenDrawer: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-[68px] items-center gap-3 border-b border-[var(--color-border)] bg-white px-4 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onOpenDrawer}
        aria-label="Apri il menu di navigazione"
        className="rounded p-2 text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)] lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <span className="text-sm font-semibold text-[var(--color-anthracite)] lg:hidden">Mizeta Mail Pipeline</span>

      <form method="GET" action="/pratiche" className="hidden min-w-0 max-w-[420px] flex-1 lg:block">
        <label className="relative block">
          <span className="sr-only">Cerca pratiche</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-muted)]"
            aria-hidden="true"
          />
          <input
            type="search"
            name="q"
            placeholder="Cerca pratica, cliente, fornitore..."
            className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] pr-3 pl-9 text-sm text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]"
          />
        </label>
      </form>

      <div className="ml-auto flex items-center gap-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${TONE_PILL_CLASSES[providerStatus.tone]}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT_CLASSES[providerStatus.tone]}`} aria-hidden="true" />
          {providerStatus.label}
        </span>
      </div>
    </header>
  );
}
