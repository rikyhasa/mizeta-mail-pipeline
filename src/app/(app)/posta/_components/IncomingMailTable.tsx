import Link from "next/link";
import { Paperclip, ShieldAlert } from "lucide-react";
import { CASE_CATEGORY_LABELS } from "@/lib/i18n/labels";
import { CategoryIcon } from "@/lib/i18n/category-icons";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { IncomingMessageListItem } from "@/lib/mail/inbox-queries";

const COLUMN_COUNT = 7;

/** Stessa composizione a tabella della reference (Categoria/Oggetto/Mittente/Ricevuta/
 * Confidenza/Allegati/Pratica), stile del pannello riusato da `CasesTable` (target). Solo la
 * cella "Pratica" è un link, come nella reference — non l'intera riga. */
export function IncomingMailTable({
  items,
  confidenceThreshold,
}: {
  items: IncomingMessageListItem[];
  confidenceThreshold: number;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-white">
      <table className="min-w-full divide-y divide-[var(--color-border)] text-sm">
        <thead className="bg-[var(--color-surface-muted)] text-left text-xs font-semibold tracking-wide text-[var(--color-ink-muted)] uppercase">
          <tr>
            <th scope="col" className="px-4 py-3.5">Categoria</th>
            <th scope="col" className="px-4 py-3.5">Oggetto</th>
            <th scope="col" className="px-4 py-3.5">Mittente</th>
            <th scope="col" className="px-4 py-3.5">Ricevuta</th>
            <th scope="col" className="px-4 py-3.5">Confidenza</th>
            <th scope="col" className="px-4 py-3.5">Allegati</th>
            <th scope="col" className="px-4 py-3.5">Pratica</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {items.map((m) => {
            const pct = m.confidence !== null ? Math.round(m.confidence * 100) : null;
            const lowConfidence = m.confidence !== null && m.confidence < confidenceThreshold;
            return (
              <tr key={m.id}>
                <td className="px-4 py-4 whitespace-nowrap text-[var(--color-ink)]">
                  {m.category ? (
                    <span className="inline-flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-muted)] text-[var(--color-anthracite)]">
                        <CategoryIcon category={m.category} className="h-4 w-4" />
                      </span>
                      {CASE_CATEGORY_LABELS[m.category]}
                    </span>
                  ) : (
                    <span className="text-[var(--color-ink-muted)]">—</span>
                  )}
                </td>
                <td className="max-w-xs px-4 py-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-[var(--color-ink)]">{m.subject}</span>
                    {m.isPec && <Badge tone="info">PEC</Badge>}
                  </div>
                  {m.securityFlagsCount > 0 && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-[var(--color-critical)]">
                      <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                      Contenuto sospetto isolato
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-[var(--color-ink)]">{m.fromName ?? m.fromAddress}</td>
                <td className="px-4 py-4 whitespace-nowrap text-[var(--color-ink-muted)]">{formatDateTime(m.receivedAt)}</td>
                <td className="px-4 py-4 whitespace-nowrap">
                  {pct !== null ? (
                    <span className={lowConfidence ? "font-semibold text-[var(--color-warning)]" : "text-[var(--color-ink)]"}>
                      {pct}%
                    </span>
                  ) : (
                    <span className="text-[var(--color-ink-muted)]">—</span>
                  )}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-[var(--color-ink)]">
                  {m.attachmentsCount > 0 ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Paperclip className="h-3.5 w-3.5 text-[var(--color-ink-muted)]" aria-hidden="true" />
                      {m.attachmentsCount}
                    </span>
                  ) : (
                    <span className="text-[var(--color-ink-muted)]">—</span>
                  )}
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  {m.caseId ? (
                    <Link
                      href={`/pratiche/${m.caseId}`}
                      className="rounded font-medium text-[var(--color-brand-dark)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]"
                    >
                      {m.caseReference}
                    </Link>
                  ) : (
                    <span className="text-[var(--color-ink-muted)]">Da associare</span>
                  )}
                </td>
              </tr>
            );
          })}
          {items.length === 0 && (
            <tr>
              <td colSpan={COLUMN_COUNT} className="px-4 py-6">
                <EmptyState title="Nessun messaggio acquisito" description="I nuovi messaggi in arrivo compariranno qui." />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
