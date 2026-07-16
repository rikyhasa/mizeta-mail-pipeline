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

/** Pillola di stato provider condivisa tra Topbar (globale) e pagine che, come la
 * reference, ne mostrano una propria nell'intestazione (es. "Posta acquisita") — stesso
 * dato reale (`getProviderStatusSummary()`), mai duplicato con un valore statico. */
export function ProviderStatusPill({ status }: { status: ProviderStatusSummary }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${TONE_PILL_CLASSES[status.tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT_CLASSES[status.tone]}`} aria-hidden="true" />
      {status.label}
    </span>
  );
}
