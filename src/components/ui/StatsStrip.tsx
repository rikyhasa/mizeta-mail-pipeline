import Link from "next/link";
import type { ReactNode } from "react";

export interface StatsStripItem {
  key: string;
  value: ReactNode;
  label: string;
  href?: string;
}

/**
 * Fascia orizzontale unica per metriche secondarie: separatori interni,
 * non una card per voce (Fase 7C, per ridurre il numero di card sullo schermo).
 */
export function StatsStrip({ items }: { items: StatsStripItem[] }) {
  return (
    <div className="grid grid-cols-2 divide-x divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-white sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {items.map((item) => {
        const content = (
          <>
            <div className="text-lg font-semibold text-[var(--color-ink)]">{item.value}</div>
            <div className="mt-1 text-xs leading-snug text-[var(--color-ink-muted)]">{item.label}</div>
          </>
        );
        const className =
          "block px-4 py-3.5 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-brand)]" +
          (item.href ? " transition-colors hover:bg-[var(--color-surface-muted)]" : "");

        return item.href ? (
          <Link key={item.key} href={item.href} className={className}>
            {content}
          </Link>
        ) : (
          <div key={item.key} className={className}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
