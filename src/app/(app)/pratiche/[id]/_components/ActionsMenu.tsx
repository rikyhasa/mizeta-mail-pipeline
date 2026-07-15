import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";

/** Popover per le azioni secondarie della testata pratica, stesso pattern di "Personalizza colonne". */
export function ActionsMenu({ children }: { children: ReactNode }) {
  return (
    <details className="group relative">
      <summary className="flex min-h-[44px] w-fit cursor-pointer list-none items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] [&::-webkit-details-marker]:hidden">
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        Altre azioni
      </summary>
      <div className="absolute right-0 z-10 mt-2 flex w-64 flex-col gap-1.5 rounded-lg border border-[var(--color-border)] bg-white p-2 shadow-md">
        {children}
      </div>
    </details>
  );
}
