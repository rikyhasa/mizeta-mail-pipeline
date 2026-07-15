import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * `<details>` nativo: i campi al suo interno restano parte di un eventuale form anche da chiusi
 * (a differenza di `hidden`), quindi i filtri avanzati funzionano senza JavaScript.
 */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  className = "",
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details open={defaultOpen} className={`group ${className}`}>
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 text-sm font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] [&::-webkit-details-marker]:hidden">
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
        {summary}
      </summary>
      <div className="pt-4">{children}</div>
    </details>
  );
}
