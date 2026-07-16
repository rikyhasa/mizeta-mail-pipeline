import { formatDate } from "@/lib/format";

/** Riepilogo compatto, non duplica la lista già in DocumentsCard (colonna principale) — solo
 * conteggio + scorciatoia (FASE 8B). */
export function DocumentsPanel({
  documentCount,
  lastDocumentAt,
}: {
  documentCount: number;
  lastDocumentAt: Date | null;
}) {
  return (
    <div className="detail-panel">
      <h2 className="text-card-title font-semibold text-[var(--color-ink)]">Documenti</h2>
      <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
        {documentCount === 0
          ? "Nessun documento generato."
          : `${documentCount} generato/i${lastDocumentAt ? `, ultimo il ${formatDate(lastDocumentAt)}` : ""}.`}
      </p>
      <a href="#documenti" className="mt-2 inline-block text-sm font-medium text-[var(--color-brand-dark)] hover:underline">
        Vai a Documenti generati →
      </a>
    </div>
  );
}
