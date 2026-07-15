import Link from "next/link";
import { CASE_CATEGORY_LABELS, CASE_PRIORITY_LABELS, CASE_STATUS_LABELS } from "@/lib/i18n/labels";
import type { CaseCategory, CasePriority, CaseStatus } from "@/generated/prisma/enums";

interface Option {
  id: string;
  name: string;
}

export function FiltersBar({
  filters,
  users,
  customers,
  suppliers,
}: {
  filters: Record<string, string | undefined>;
  users: Option[];
  customers: Option[];
  suppliers: Option[];
}) {
  return (
    <section aria-label="Filtri" className="rounded-lg border border-slate-200 bg-white p-4">
      <form method="GET" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          Categoria
          <select name="category" defaultValue={filters.category ?? ""} className="rounded border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">Tutte</option>
            {(Object.keys(CASE_CATEGORY_LABELS) as CaseCategory[]).map((c) => (
              <option key={c} value={c}>
                {CASE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-600">
          Stato
          <select name="status" defaultValue={filters.status ?? ""} className="rounded border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">Tutti</option>
            {(Object.keys(CASE_STATUS_LABELS) as CaseStatus[]).map((s) => (
              <option key={s} value={s}>
                {CASE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-600">
          Priorità
          <select name="priority" defaultValue={filters.priority ?? ""} className="rounded border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">Tutte</option>
            {(Object.keys(CASE_PRIORITY_LABELS) as CasePriority[]).map((p) => (
              <option key={p} value={p}>
                {CASE_PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-600">
          Responsabile
          <select name="responsibleId" defaultValue={filters.responsibleId ?? ""} className="rounded border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">Tutti</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-600">
          Cliente
          <select name="customerId" defaultValue={filters.customerId ?? ""} className="rounded border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">Tutti</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-600">
          Fornitore
          <select name="supplierId" defaultValue={filters.supplierId ?? ""} className="rounded border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">Tutti</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-600">
          Data da
          <input type="date" name="dateFrom" defaultValue={filters.dateFrom ?? ""} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-600">
          Data a
          <input type="date" name="dateTo" defaultValue={filters.dateTo ?? ""} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-600">
          Importo minimo
          <input
            type="number"
            name="amountMin"
            defaultValue={filters.amountMin ?? ""}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-600">
          Importo massimo
          <input
            type="number"
            name="amountMax"
            defaultValue={filters.amountMax ?? ""}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>

        <div className="col-span-2 flex flex-wrap items-center gap-4 sm:col-span-3 lg:col-span-5">
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" name="lowConfidence" value="1" defaultChecked={filters.lowConfidence === "1"} />
            Bassa confidenza
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" name="hasAttachments" value="1" defaultChecked={filters.hasAttachments === "1"} />
            Con allegati
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" name="overdue" value="1" defaultChecked={filters.overdue === "1"} />
            Scaduto
          </label>

          <button type="submit" className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700">
            Applica filtri
          </button>
          <Link href="/pratiche" className="text-xs text-slate-500 underline hover:text-slate-900">
            Azzera filtri
          </Link>
        </div>
      </form>
    </section>
  );
}
