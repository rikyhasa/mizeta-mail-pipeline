import { CheckCircle2, Sparkles } from "lucide-react";
import { buttonClassName } from "@/components/ui/Button";
import type { RecommendedActionData } from "./recommended-action";

/** Primo gruppo del pannello laterale (FASE 8B): un solo blocco prominente, peso visivo
 * maggiore di "Azioni rapide" — problema #6/#8 del task doc (nessuna azione consigliata
 * chiara, azioni tutte con lo stesso peso). Puro link di navigazione: nessuna mutazione, la
 * classe di Button viene riusata solo per lo stile. */
export function RecommendedAction({ action }: { action: RecommendedActionData | null }) {
  if (!action) {
    return (
      <div className="detail-panel flex items-center gap-2.5 text-sm text-[var(--color-ink-muted)]">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--color-forest)]" aria-hidden="true" />
        Nessuna azione consigliata al momento.
      </div>
    );
  }

  return (
    <div className="detail-panel border-[color-mix(in_srgb,var(--color-brand)_30%,white)] bg-[color-mix(in_srgb,var(--color-brand)_7%,white)]">
      <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-[var(--color-brand-dark)] uppercase">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        Prossima azione
      </div>
      <p className="mt-2 text-sm font-semibold text-[var(--color-ink)]">{action.label}</p>
      {action.description && <p className="mt-1 text-xs text-[var(--color-ink-muted)]">{action.description}</p>}
      <a href={action.href} className={buttonClassName({ variant: "primary", size: "md", className: "mt-3 w-full" })}>
        {action.ctaLabel}
      </a>
    </div>
  );
}
