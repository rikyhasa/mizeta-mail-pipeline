import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { CASE_CATEGORY_LABELS, CASE_PRIORITY_LABELS, CASE_STATUS_LABELS } from "@/lib/i18n/labels";
import type { CaseCategory, CasePriority, CaseStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/Button";
import { CheckboxField, fieldControlClassName } from "@/components/ui/Field";

interface Option {
  id: string;
  name: string;
}

const ADVANCED_KEYS = [
  "responsibleId",
  "customerId",
  "supplierId",
  "dateFrom",
  "dateTo",
  "amountMin",
  "amountMax",
  "lowConfidence",
  "hasAttachments",
  "overdue",
];

const toolbarSelectClassName =
  "min-h-[44px] rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]";

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
  const hasAdvancedActive = ADVANCED_KEYS.some((key) => filters[key]);

  return (
    <section aria-label="Filtri" className="rounded-xl border border-[var(--color-border)] bg-white p-2.5">
      <form method="GET" className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-muted)]"
            aria-hidden="true"
          />
          <input
            type="search"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Cerca pratica, cliente, fornitore..."
            aria-label="Cerca in questa vista"
            className={`${fieldControlClassName} pl-9`}
          />
        </div>

        <select name="category" defaultValue={filters.category ?? ""} aria-label="Categoria" className={toolbarSelectClassName}>
          <option value="">Tutte le categorie</option>
          {(Object.keys(CASE_CATEGORY_LABELS) as CaseCategory[]).map((c) => (
            <option key={c} value={c}>
              {CASE_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>

        <select name="status" defaultValue={filters.status ?? ""} aria-label="Stato" className={toolbarSelectClassName}>
          <option value="">Tutti gli stati</option>
          {(Object.keys(CASE_STATUS_LABELS) as CaseStatus[]).map((s) => (
            <option key={s} value={s}>
              {CASE_STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        <select name="priority" defaultValue={filters.priority ?? ""} aria-label="Priorità" className={toolbarSelectClassName}>
          <option value="">Tutte le priorità</option>
          {(Object.keys(CASE_PRIORITY_LABELS) as CasePriority[]).map((p) => (
            <option key={p} value={p}>
              {CASE_PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>

        <details className="group relative" open={hasAdvancedActive || undefined}>
          <summary
            className={`flex min-h-[44px] w-fit cursor-pointer list-none items-center gap-1.5 rounded-lg border px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] [&::-webkit-details-marker]:hidden ${
              hasAdvancedActive
                ? "border-[var(--color-brand)] text-[var(--color-brand-dark)]"
                : "border-[var(--color-border)] text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)]"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Altri filtri
          </summary>
          <div className="absolute right-0 z-10 mt-2 w-[min(90vw,480px)] rounded-lg border border-[var(--color-border)] bg-white p-4 shadow-md">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-ink)]">
                Responsabile
                <select name="responsibleId" defaultValue={filters.responsibleId ?? ""} className={fieldControlClassName}>
                  <option value="">Tutti</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-ink)]">
                Cliente
                <select name="customerId" defaultValue={filters.customerId ?? ""} className={fieldControlClassName}>
                  <option value="">Tutti</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-ink)]">
                Fornitore
                <select name="supplierId" defaultValue={filters.supplierId ?? ""} className={fieldControlClassName}>
                  <option value="">Tutti</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <div />

              <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-ink)]">
                Pratica creata dal
                <input type="date" name="dateFrom" defaultValue={filters.dateFrom ?? ""} className={fieldControlClassName} />
              </label>

              <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-ink)]">
                Pratica creata al
                <input type="date" name="dateTo" defaultValue={filters.dateTo ?? ""} className={fieldControlClassName} />
              </label>

              <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-ink)]">
                Importo minimo
                <input type="number" name="amountMin" defaultValue={filters.amountMin ?? ""} className={fieldControlClassName} />
              </label>

              <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-ink)]">
                Importo massimo
                <input type="number" name="amountMax" defaultValue={filters.amountMax ?? ""} className={fieldControlClassName} />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-[var(--color-border)] pt-3">
              <CheckboxField name="lowConfidence" label="Bassa confidenza" defaultChecked={filters.lowConfidence === "1"} />
              <CheckboxField name="hasAttachments" label="Con allegati" defaultChecked={filters.hasAttachments === "1"} />
              <CheckboxField name="overdue" label="Scaduto" defaultChecked={filters.overdue === "1"} />
            </div>
          </div>
        </details>

        <Button type="submit" variant="primary" size="md">
          Applica
        </Button>
        <Link href="/pratiche" className="text-sm font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:underline">
          Azzera filtri
        </Link>
      </form>
    </section>
  );
}
