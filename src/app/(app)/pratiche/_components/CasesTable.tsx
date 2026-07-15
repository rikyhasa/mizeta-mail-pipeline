"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useSyncExternalStore, type MouseEvent } from "react";
import { ChevronRight, SlidersHorizontal } from "lucide-react";
import type { CaseListItem } from "@/lib/dashboard/queries";
import { PAGE_SIZE } from "@/lib/dashboard/constants";
import { CASE_CATEGORY_LABELS } from "@/lib/i18n/labels";
import { CategoryIcon } from "@/lib/i18n/category-icons";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { PriorityBadge, StatusBadge, Badge } from "@/components/ui/Badge";
import { buttonClassName } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

const OPTIONAL_COLUMNS = [
  { key: "amount", label: "Importo" },
  { key: "responsible", label: "Responsabile" },
  { key: "updatedAt", label: "Ultima attività" },
] as const;
type OptionalColumnKey = (typeof OPTIONAL_COLUMNS)[number]["key"];
const STORAGE_KEY = "mizeta:pratiche:colonne";
const COLUMNS_CHANGE_EVENT = "mizeta:pratiche:colonne:change";

function pageHref(searchParams: Record<string, string | undefined>, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && key !== "page") params.set(key, value);
  }
  params.set("page", String(page));
  return `/pratiche?${params.toString()}`;
}

function subscribeToColumnsChange(callback: () => void) {
  window.addEventListener(COLUMNS_CHANGE_EVENT, callback);
  return () => window.removeEventListener(COLUMNS_CHANGE_EVENT, callback);
}

function getColumnsSnapshot(): string {
  return window.localStorage.getItem(STORAGE_KEY) ?? "";
}

function getColumnsServerSnapshot(): string {
  return "";
}

/**
 * Preferenza personale (non condivisa tra utenti/URL), letta tramite useSyncExternalStore per
 * evitare mismatch di idratazione tra il rendering server e il valore in localStorage.
 */
function useOptionalColumns() {
  const raw = useSyncExternalStore(subscribeToColumnsChange, getColumnsSnapshot, getColumnsServerSnapshot);

  const visible = useMemo(() => {
    try {
      return raw ? new Set<OptionalColumnKey>(JSON.parse(raw)) : new Set<OptionalColumnKey>();
    } catch {
      return new Set<OptionalColumnKey>();
    }
  }, [raw]);

  function toggle(key: OptionalColumnKey) {
    const next = new Set(visible);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      window.dispatchEvent(new Event(COLUMNS_CHANGE_EVENT));
    } catch {
      // preferenza non persistita, ma la sessione corrente funziona comunque.
    }
  }

  return { visible, toggle };
}

function ColumnsControl({ visible, toggle }: { visible: Set<OptionalColumnKey>; toggle: (key: OptionalColumnKey) => void }) {
  return (
    <details className="group relative">
      <summary className="flex min-h-[36px] w-fit cursor-pointer list-none items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
        Personalizza colonne
      </summary>
      <div className="absolute right-0 z-10 mt-2 w-56 rounded-lg border border-[var(--color-border)] bg-white p-3 shadow-md">
        <p className="mb-2 text-xs font-medium text-[var(--color-ink-muted)]">Colonne aggiuntive</p>
        <div className="flex flex-col gap-2">
          {OPTIONAL_COLUMNS.map((col) => (
            <label key={col.key} className="flex min-h-[36px] items-center gap-2 text-sm text-[var(--color-ink)]">
              <input
                type="checkbox"
                checked={visible.has(col.key)}
                onChange={() => toggle(col.key)}
                className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-brand)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]"
              />
              {col.label}
            </label>
          ))}
        </div>
      </div>
    </details>
  );
}

export function CasesTable({
  items,
  total,
  page,
  searchParams,
}: {
  items: CaseListItem[];
  total: number;
  page: number;
  searchParams: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const { visible, toggle } = useOptionalColumns();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function goToCase(id: string, event: MouseEvent<HTMLTableRowElement>) {
    if ((event.target as HTMLElement).closest("a")) return;
    router.push(`/pratiche/${id}`);
  }

  const showAmount = visible.has("amount");
  const showResponsible = visible.has("responsible");
  const showUpdatedAt = visible.has("updatedAt");

  return (
    <section aria-label="Elenco pratiche" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-ink-muted)]">{total} pratiche trovate</p>
        <ColumnsControl visible={visible} toggle={toggle} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-white">
        <table className="min-w-full divide-y divide-[var(--color-border)] text-sm">
          <thead className="bg-[var(--color-surface-muted)] text-left text-xs font-medium tracking-wide text-[var(--color-ink-muted)] uppercase">
            <tr>
              <th scope="col" className="px-4 py-3">Tipo</th>
              <th scope="col" className="px-4 py-3">Titolo</th>
              <th scope="col" className="px-4 py-3">Cliente / Fornitore</th>
              <th scope="col" className="px-4 py-3">Scadenza</th>
              <th scope="col" className="px-4 py-3">Priorità</th>
              <th scope="col" className="px-4 py-3">Stato</th>
              {showAmount && <th scope="col" className="px-4 py-3">Importo</th>}
              {showResponsible && <th scope="col" className="px-4 py-3">Responsabile</th>}
              {showUpdatedAt && <th scope="col" className="px-4 py-3">Ultima attività</th>}
              <th scope="col" className="px-2 py-3">
                <span className="sr-only">Apri pratica</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {items.map((c) => {
              const showNeedsReviewBadge = c.needsHumanReview && c.status !== "NEEDS_REVIEW";
              return (
                <tr
                  key={c.id}
                  onClick={(event) => goToCase(c.id, event)}
                  className="group cursor-pointer transition-colors hover:bg-[var(--color-surface-muted)]"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--color-ink)]">
                    <span className="inline-flex items-center gap-1.5">
                      <CategoryIcon category={c.category} className="h-4 w-4 text-[var(--color-ink-muted)]" />
                      {CASE_CATEGORY_LABELS[c.category]}
                    </span>
                  </td>
                  <td className="max-w-xs px-4 py-3">
                    <Link
                      href={`/pratiche/${c.id}`}
                      className="rounded font-medium text-[var(--color-ink)] underline-offset-2 hover:text-[var(--color-brand-dark)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]"
                    >
                      {c.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {c.isPec && <Badge tone="info">PEC</Badge>}
                      {showNeedsReviewBadge && <Badge tone="warning">Da verificare</Badge>}
                      {c.hasAttachments && <Badge tone="neutral">Allegati</Badge>}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--color-ink)]">{c.customerOrSupplierName ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--color-ink)]">{formatDate(c.nextDeadline)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <PriorityBadge priority={c.priority} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  {showAmount && (
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--color-ink)]">{formatCurrency(c.amount)}</td>
                  )}
                  {showResponsible && (
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--color-ink)]">
                      {c.responsibleName ?? "Non assegnato"}
                    </td>
                  )}
                  {showUpdatedAt && (
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--color-ink-muted)]">
                      {formatDateTime(c.updatedAt)}
                    </td>
                  )}
                  <td className="px-2 py-3 text-[var(--color-ink-muted)]">
                    <ChevronRight
                      className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td
                  colSpan={6 + Number(showAmount) + Number(showResponsible) + Number(showUpdatedAt) + 1}
                  className="px-4 py-6"
                >
                  <EmptyState
                    title="Nessuna pratica corrisponde ai filtri selezionati"
                    description="Prova a rimuovere qualche filtro per allargare la ricerca."
                    action={
                      <Link href="/pratiche" className={buttonClassName({ variant: "secondary", size: "sm" })}>
                        Rimuovi filtri
                      </Link>
                    }
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <nav aria-label="Paginazione" className="flex items-center justify-between text-sm text-[var(--color-ink-muted)]">
          <span>
            Pagina {page} di {totalPages} — {total} pratiche totali
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={pageHref(searchParams, page - 1)} className={buttonClassName({ variant: "secondary", size: "sm" })}>
                ← Precedente
              </Link>
            )}
            {page < totalPages && (
              <Link href={pageHref(searchParams, page + 1)} className={buttonClassName({ variant: "secondary", size: "sm" })}>
                Successiva →
              </Link>
            )}
          </div>
        </nav>
      )}
    </section>
  );
}
