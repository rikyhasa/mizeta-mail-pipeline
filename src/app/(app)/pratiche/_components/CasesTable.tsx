import Link from "next/link";
import type { CaseListItem } from "@/lib/dashboard/queries";
import { PAGE_SIZE } from "@/lib/dashboard/queries";
import { CASE_CATEGORY_LABELS, CASE_PRIORITY_LABELS, CASE_STATUS_LABELS } from "@/lib/i18n/labels";
import { CategoryIcon } from "@/lib/i18n/category-icons";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";

const PRIORITY_BADGE_CLASSES: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800",
  HIGH: "bg-orange-100 text-orange-800",
  NORMAL: "bg-slate-100 text-slate-700",
  LOW: "bg-slate-50 text-slate-500",
};

function pageHref(searchParams: Record<string, string | undefined>, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && key !== "page") params.set(key, value);
  }
  params.set("page", String(page));
  return `/pratiche?${params.toString()}`;
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
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section aria-label="Elenco pratiche" className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3">Tipo</th>
              <th scope="col" className="px-4 py-3">Titolo</th>
              <th scope="col" className="px-4 py-3">Cliente / Fornitore</th>
              <th scope="col" className="px-4 py-3">Importo</th>
              <th scope="col" className="px-4 py-3">Scadenza</th>
              <th scope="col" className="px-4 py-3">Priorità</th>
              <th scope="col" className="px-4 py-3">Responsabile</th>
              <th scope="col" className="px-4 py-3">Stato</th>
              <th scope="col" className="px-4 py-3">Ultima attività</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                  <span className="inline-flex items-center gap-1.5">
                    <CategoryIcon category={c.category} />
                    {CASE_CATEGORY_LABELS[c.category]}
                  </span>
                </td>
                <td className="max-w-xs px-4 py-3">
                  <Link
                    href={`/pratiche/${c.id}`}
                    className="rounded text-slate-900 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                  >
                    {c.title}
                  </Link>
                  <div className="mt-1 flex gap-1">
                    {c.isPec && (
                      <span className="inline-flex w-fit items-center rounded bg-indigo-100 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700">
                        PEC
                      </span>
                    )}
                    {c.needsHumanReview && (
                      <span className="inline-flex w-fit items-center rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                        Da verificare
                      </span>
                    )}
                    {c.hasAttachments && (
                      <span className="inline-flex w-fit items-center rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                        Allegati
                      </span>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">{c.customerOrSupplierName ?? "—"}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatCurrency(c.amount)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDate(c.nextDeadline)}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE_CLASSES[c.priority]}`}>
                    {CASE_PRIORITY_LABELS[c.priority]}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">{c.responsibleName ?? "Non assegnato"}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">{CASE_STATUS_LABELS[c.status]}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDateTime(c.updatedAt)}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">
                  Nessuna pratica trovata con i filtri selezionati.{" "}
                  <Link href="/pratiche" className="underline hover:text-slate-900">
                    Azzera i filtri
                  </Link>
                  .
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <nav aria-label="Paginazione" className="flex items-center justify-between text-sm text-slate-600">
          <span>
            Pagina {page} di {totalPages} — {total} pratiche totali
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={pageHref(searchParams, page - 1)}
                className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                ← Precedente
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={pageHref(searchParams, page + 1)}
                className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                Successiva →
              </Link>
            )}
          </div>
        </nav>
      )}
    </section>
  );
}
