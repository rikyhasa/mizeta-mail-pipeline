import type { ReactNode } from "react";

/**
 * Blocco visivo condiviso. `variant="surface"` (default) è la card piena
 * usata per unità autonome (bordo + sfondo + ombra morbida). `variant="flat"`
 * è un blocco con sfondo distinto ma senza bordo/ombra, per raggruppare
 * contenuto senza aggiungere un'altra card — vedi anche `Section` per
 * raggruppamenti senza sfondo.
 */
export function Card({
  children,
  className = "",
  padding = "normal",
  variant = "surface",
  id,
}: {
  children: ReactNode;
  className?: string;
  padding?: "normal" | "compact" | "none";
  variant?: "surface" | "flat";
  /** Bersaglio di scroll per link di ancoraggio (es. le scorciatoie della colonna azioni). */
  id?: string;
}) {
  const paddingClass =
    padding === "none" ? "" : padding === "compact" ? "p-4" : "p-6";
  const variantClass =
    variant === "flat"
      ? "rounded-xl bg-[var(--color-surface-muted)]"
      : "rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm";
  return (
    <div id={id} className={`${variantClass} ${paddingClass} ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold text-[var(--color-ink)]">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
