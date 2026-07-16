import Link from "next/link";
import { AUDIT_ACTION_LABELS } from "@/lib/i18n/labels";
import { formatDateTime } from "@/lib/format";
import { EmptyState } from "@/components/ui/EmptyState";
import type { AuditLogEntry } from "@/lib/audit/queries";

const COLUMN_COUNT = 4;

/** Stesso stile pannello/tabella già stabilito per `/posta` (`IncomingMailTable`) — 4 colonne
 * reali (Data e ora, Azione, Pratica, Attore), niente colonna "Dettaglio" (v. commento in
 * `queries.ts`). */
export function AuditLogTable({ items }: { items: AuditLogEntry[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-white">
      <table className="min-w-full divide-y divide-[var(--color-border)] text-sm">
        <thead className="bg-[var(--color-surface-muted)] text-left text-xs font-semibold tracking-wide text-[var(--color-ink-muted)] uppercase">
          <tr>
            <th scope="col" className="px-4 py-3.5">Data e ora</th>
            <th scope="col" className="px-4 py-3.5">Azione</th>
            <th scope="col" className="px-4 py-3.5">Pratica</th>
            <th scope="col" className="px-4 py-3.5">Attore</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {items.map((log) => (
            <tr key={log.id}>
              <td className="px-4 py-3 whitespace-nowrap text-[var(--color-ink-muted)]">{formatDateTime(log.createdAt)}</td>
              <td className="px-4 py-3 whitespace-nowrap font-medium text-[var(--color-ink)]">{AUDIT_ACTION_LABELS[log.action]}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                {log.caseId ? (
                  <Link
                    href={`/pratiche/${log.caseId}`}
                    className="rounded font-medium text-[var(--color-brand-dark)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]"
                  >
                    {log.caseReference}
                  </Link>
                ) : (
                  <span className="text-[var(--color-ink-muted)]">—</span>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-[var(--color-ink)]">{log.actorName ?? "Sistema"}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={COLUMN_COUNT} className="px-4 py-6">
                <EmptyState title="Nessuna voce registrata" description="Gli eventi importanti compariranno qui." />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
