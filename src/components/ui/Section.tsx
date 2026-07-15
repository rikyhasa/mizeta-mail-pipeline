import type { ReactNode } from "react";

/**
 * Raggruppa titolo + contenuto senza bordo/sfondo/ombra: per separare zone
 * di una pagina che non sono un'unità autonoma (a differenza di `Card`),
 * usando spazio, titolo e tipografia invece di un'altra card bordata.
 */
export function Section({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      {(title || action) && (
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            {title && (
              <h2 className="text-section-title font-semibold text-[var(--color-ink)]">{title}</h2>
            )}
            {description && (
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
