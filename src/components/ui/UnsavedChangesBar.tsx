import type { ReactNode } from "react";
import { buttonClassName } from "@/components/ui/Button";

/**
 * Barra sticky sempre raggiungibile quando un form ha modifiche non salvate: il pulsante di
 * salvataggio non deve trovarsi soltanto dopo un lunghissimo scroll (FASE-7-REDESIGN.md).
 * Va montata dentro il `<form>` interessato così il submit resta collegato al suo handler.
 */
export function UnsavedChangesBar({
  visible,
  pending,
  error,
  onCancel,
  savedMessage,
}: {
  visible: boolean;
  pending: boolean;
  error?: string | null;
  onCancel: () => void;
  savedMessage?: ReactNode;
}) {
  if (!visible) {
    return savedMessage ? <p className="text-sm text-[var(--color-forest)]">{savedMessage}</p> : null;
  }

  return (
    <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 shadow-md">
      <span className="text-sm font-medium text-[var(--color-ink)]">Modifiche non salvate</span>
      <div className="flex items-center gap-3">
        {error && (
          <span role="alert" className="text-xs text-red-600">
            {error}
          </span>
        )}
        <button type="button" onClick={onCancel} className={buttonClassName({ variant: "tertiary", size: "sm" })}>
          Annulla
        </button>
        <button type="submit" disabled={pending} className={buttonClassName({ variant: "primary", size: "sm" })}>
          {pending ? "Salvataggio..." : "Salva impostazioni"}
        </button>
      </div>
    </div>
  );
}
