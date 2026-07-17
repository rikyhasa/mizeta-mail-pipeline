import { Menu } from "lucide-react";
import type { ProviderStatusSummary } from "@/lib/observability/provider-status";
import { ProviderStatusPill } from "@/components/ProviderStatusPill";
import { GlobalSearch } from "./GlobalSearch";

/**
 * Topbar client-only per il drawer mobile (`onOpenDrawer`); ricerca globale in dropdown
 * (`GlobalSearch.tsx`, FASE 3 rifinitura finale) reale verso `/api/cases/search`, che riusa
 * `getFilteredCases` — nessun risultato simulato.
 */
export function Topbar({
  providerStatus,
  onOpenDrawer,
}: {
  providerStatus: ProviderStatusSummary;
  onOpenDrawer: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-[68px] items-center gap-3 border-b border-[var(--color-border)] bg-white px-4 sm:px-6 print:hidden lg:px-8">
      <button
        type="button"
        onClick={onOpenDrawer}
        aria-label="Apri il menu di navigazione"
        className="rounded p-2 text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)] lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <span className="text-sm font-semibold text-[var(--color-anthracite)] lg:hidden">Mizeta Mail Pipeline</span>

      <GlobalSearch />

      <div className="ml-auto flex items-center gap-3">
        <ProviderStatusPill status={providerStatus} />
      </div>
    </header>
  );
}
