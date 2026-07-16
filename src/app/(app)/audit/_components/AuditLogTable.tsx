import Link from "next/link";
import { AUDIT_ACTION_LABELS } from "@/lib/i18n/labels";
import { formatDateTime } from "@/lib/format";
import { EmptyState } from "@/components/ui/EmptyState";
import type { AuditAction } from "@/generated/prisma/enums";
import type { AuditLogEntry } from "@/lib/audit/queries";

const COLUMN_COUNT = 4;

interface DisplayRow {
  key: string;
  createdAt: Date;
  action: AuditAction;
  actionLabel: string;
  caseId: string | null;
  caseReference: string | null;
  actorName: string | null;
  groupCount: number;
}

/** Gli "Accesso alla pratica" (CASE_VIEWED) consecutivi sulla stessa pratica/attore si
 * accumulano rapidamente (ogni apertura del dettaglio pratica ne scrive uno) e non sono
 * eventi individualmente significativi in un registro cronologico — raggruppati in un'unica
 * riga ("N accessi alla pratica"), stesso principio già applicato per-pratica in
 * `AuditLogCard.tsx`. Solo run consecutivi: non altera l'ordine cronologico. */
function buildDisplayRows(items: AuditLogEntry[]): DisplayRow[] {
  const rows: DisplayRow[] = [];
  for (const log of items) {
    const last = rows[rows.length - 1];
    if (log.action === "CASE_VIEWED" && last?.action === "CASE_VIEWED" && last.caseId === log.caseId && last.actorName === log.actorName) {
      last.groupCount += 1;
      last.actionLabel = `${last.groupCount} accessi alla pratica`;
      continue;
    }
    rows.push({
      key: log.id,
      createdAt: log.createdAt,
      action: log.action,
      actionLabel: AUDIT_ACTION_LABELS[log.action],
      caseId: log.caseId,
      caseReference: log.caseReference,
      actorName: log.actorName,
      groupCount: 1,
    });
  }
  return rows;
}

/** Stesso stile pannello/tabella già stabilito per `/posta` (`IncomingMailTable`) — 4 colonne
 * reali (Data e ora, Azione, Pratica, Attore), niente colonna "Dettaglio" (v. commento in
 * `queries.ts`). */
export function AuditLogTable({ items }: { items: AuditLogEntry[] }) {
  const rows = buildDisplayRows(items);

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
          {rows.map((row) => (
            <tr key={row.key}>
              <td className="px-4 py-3 whitespace-nowrap text-[var(--color-ink-muted)]">{formatDateTime(row.createdAt)}</td>
              <td className="px-4 py-3 whitespace-nowrap font-medium text-[var(--color-ink)]">{row.actionLabel}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                {row.caseId ? (
                  <Link
                    href={`/pratiche/${row.caseId}`}
                    className="rounded font-medium text-[var(--color-brand-dark)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]"
                  >
                    {row.caseReference}
                  </Link>
                ) : (
                  <span className="text-[var(--color-ink-muted)]">—</span>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-[var(--color-ink)]">{row.actorName ?? "Sistema"}</td>
            </tr>
          ))}
          {rows.length === 0 && (
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
