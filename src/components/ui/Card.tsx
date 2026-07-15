import type { ReactNode } from "react";

/** Blocco visivo condiviso: sfondo bianco, bordo sottile, ombra morbida, angoli arrotondati. */
export function Card({
  children,
  className = "",
  padding = "normal",
}: {
  children: ReactNode;
  className?: string;
  padding?: "normal" | "compact" | "none";
}) {
  const paddingClass =
    padding === "none" ? "" : padding === "compact" ? "p-4" : "p-6";
  return (
    <div
      className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm ${paddingClass} ${className}`}
    >
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
