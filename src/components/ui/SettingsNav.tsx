"use client";

import { useState } from "react";
import type { TabItem } from "./Tabs";

/**
 * Navigazione secondaria verticale per Impostazioni: menu a sinistra, contenuto a
 * destra — un componente nuovo, non un riuso di `Tabs` (che resta orizzontale per il
 * dettaglio pratica). Stato locale, tutti i pannelli montati e nascosti come in `Tabs`.
 */
export function SettingsNav({
  items,
  defaultValue,
  className = "",
}: {
  items: TabItem[];
  defaultValue?: string;
  className?: string;
}) {
  const [active, setActive] = useState(defaultValue ?? items[0]?.value);

  return (
    <div className={`grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start ${className}`}>
      <nav
        aria-label="Sezioni impostazioni"
        className="flex gap-1 overflow-x-auto lg:sticky lg:top-14 lg:flex-col lg:overflow-visible"
      >
        {items.map((item) => {
          const selected = item.value === active;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setActive(item.value)}
              aria-current={selected ? "page" : undefined}
              className={`flex min-h-[44px] shrink-0 items-center gap-2.5 rounded-lg px-3 text-left text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] ${
                selected
                  ? "bg-[color-mix(in_srgb,var(--color-brand)_10%,white)] text-[var(--color-brand-dark)] shadow-[inset_3px_0_0_var(--color-brand)]"
                  : "text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="min-w-0">
        {items.map((item) => (
          <div key={item.value} hidden={item.value !== active}>
            {item.value === active ? item.content : null}
          </div>
        ))}
      </div>
    </div>
  );
}
