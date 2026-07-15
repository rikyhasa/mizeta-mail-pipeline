"use client";

import { useId, useState, type KeyboardEvent, type ReactNode } from "react";

export type TabItem = {
  value: string;
  label: string;
  /** Elemento icona già renderizzato (es. `<Info className="h-4 w-4" />`), non un riferimento al
   * componente: i riferimenti a funzioni non attraversano il confine server/client component. */
  icon?: ReactNode;
  content: ReactNode;
};

/** Tab accessibili (WAI-ARIA tabs pattern): frecce per navigare, contenuto caricato on-demand. */
export function Tabs({
  tabs,
  defaultValue,
  className = "",
}: {
  tabs: TabItem[];
  defaultValue?: string;
  className?: string;
}) {
  const [active, setActive] = useState(defaultValue ?? tabs[0]?.value);
  const idBase = useId();

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + direction + tabs.length) % tabs.length;
    setActive(tabs[nextIndex].value);
    const nextButton = document.getElementById(`${idBase}-tab-${tabs[nextIndex].value}`);
    nextButton?.focus();
  }

  return (
    <div className={`min-w-0 ${className}`}>
      <div
        role="tablist"
        aria-label="Sezioni"
        className="flex min-w-0 gap-1 overflow-x-auto border-b border-[var(--color-border)]"
      >
        {tabs.map((tab, index) => {
          const selected = tab.value === active;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              id={`${idBase}-tab-${tab.value}`}
              aria-selected={selected}
              aria-controls={`${idBase}-panel-${tab.value}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.value)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 border-b-2 px-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] ${
                selected
                  ? "border-[var(--color-brand)] text-[var(--color-brand-dark)]"
                  : "border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.value}
          role="tabpanel"
          id={`${idBase}-panel-${tab.value}`}
          aria-labelledby={`${idBase}-tab-${tab.value}`}
          hidden={tab.value !== active}
          className="pt-6"
        >
          {tab.value === active ? tab.content : null}
        </div>
      ))}
    </div>
  );
}
