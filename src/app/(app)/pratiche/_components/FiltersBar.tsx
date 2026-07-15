import Link from "next/link";
import { CASE_CATEGORY_LABELS, CASE_PRIORITY_LABELS, CASE_STATUS_LABELS } from "@/lib/i18n/labels";
import type { CaseCategory, CasePriority, CaseStatus } from "@/generated/prisma/enums";
import { Card } from "@/components/ui/Card";
import { Disclosure } from "@/components/ui/Disclosure";
import { Button } from "@/components/ui/Button";
import { FormField, CheckboxField, fieldControlClassName } from "@/components/ui/Field";

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
    <section aria-label="Filtri">
    <Card padding="compact">
      <form method="GET" className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FormField label="Categoria" htmlFor="filter-category">
            <select
              id="filter-category"
              name="category"
              defaultValue={filters.category ?? ""}
              className={fieldControlClassName}
            >
              <option value="">Tutte</option>
              {(Object.keys(CASE_CATEGORY_LABELS) as CaseCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CASE_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Stato" htmlFor="filter-status">
            <select
              id="filter-status"
              name="status"
              defaultValue={filters.status ?? ""}
              className={fieldControlClassName}
            >
              <option value="">Tutti</option>
              {(Object.keys(CASE_STATUS_LABELS) as CaseStatus[]).map((s) => (
                <option key={s} value={s}>
                  {CASE_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Priorità" htmlFor="filter-priority">
            <select
              id="filter-priority"
              name="priority"
              defaultValue={filters.priority ?? ""}
              className={fieldControlClassName}
            >
              <option value="">Tutte</option>
              {(Object.keys(CASE_PRIORITY_LABELS) as CasePriority[]).map((p) => (
                <option key={p} value={p}>
                  {CASE_PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <Disclosure summary="Filtri avanzati" defaultOpen={hasAdvancedActive}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="Responsabile" htmlFor="filter-responsibleId">
              <select
                id="filter-responsibleId"
                name="responsibleId"
                defaultValue={filters.responsibleId ?? ""}
                className={fieldControlClassName}
              >
                <option value="">Tutti</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Cliente" htmlFor="filter-customerId">
              <select
                id="filter-customerId"
                name="customerId"
                defaultValue={filters.customerId ?? ""}
                className={fieldControlClassName}
              >
                <option value="">Tutti</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Fornitore" htmlFor="filter-supplierId">
              <select
                id="filter-supplierId"
                name="supplierId"
                defaultValue={filters.supplierId ?? ""}
                className={fieldControlClassName}
              >
                <option value="">Tutti</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Pratica creata dal" htmlFor="filter-dateFrom">
              <input
                id="filter-dateFrom"
                type="date"
                name="dateFrom"
                defaultValue={filters.dateFrom ?? ""}
                className={fieldControlClassName}
              />
            </FormField>

            <FormField label="Pratica creata al" htmlFor="filter-dateTo">
              <input
                id="filter-dateTo"
                type="date"
                name="dateTo"
                defaultValue={filters.dateTo ?? ""}
                className={fieldControlClassName}
              />
            </FormField>

            <FormField label="Importo minimo" htmlFor="filter-amountMin">
              <input
                id="filter-amountMin"
                type="number"
                name="amountMin"
                defaultValue={filters.amountMin ?? ""}
                className={fieldControlClassName}
              />
            </FormField>

            <FormField label="Importo massimo" htmlFor="filter-amountMax">
              <input
                id="filter-amountMax"
                type="number"
                name="amountMax"
                defaultValue={filters.amountMax ?? ""}
                className={fieldControlClassName}
              />
            </FormField>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4">
            <CheckboxField name="lowConfidence" label="Bassa confidenza" defaultChecked={filters.lowConfidence === "1"} />
            <CheckboxField name="hasAttachments" label="Con allegati" defaultChecked={filters.hasAttachments === "1"} />
            <CheckboxField name="overdue" label="Scaduto" defaultChecked={filters.overdue === "1"} />
          </div>
        </Disclosure>

        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" variant="primary" size="md">
            Applica filtri
          </Button>
          <Link href="/pratiche" className="text-sm font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:underline">
            Azzera filtri
          </Link>
        </div>
      </form>
    </Card>
    </section>
  );
}
