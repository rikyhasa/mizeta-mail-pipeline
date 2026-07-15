import type { ComponentType, ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";

/** Stato vuoto rassicurante: icona + messaggio chiaro, mai solo una tabella vuota. */
export function EmptyState({
  icon: Icon = CheckCircle2,
  title,
  description,
  action,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] bg-white px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface-muted)] text-[var(--color-ink-muted)]">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <p className="text-sm font-medium text-[var(--color-ink)]">{title}</p>
      {description && <p className="max-w-sm text-sm text-[var(--color-ink-muted)]">{description}</p>}
      {action}
    </div>
  );
}
