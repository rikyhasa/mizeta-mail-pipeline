import Link from "next/link";
import { X } from "lucide-react";
import { CASE_CATEGORY_LABELS, CASE_PRIORITY_LABELS, CASE_STATUS_LABELS } from "@/lib/i18n/labels";
import { formatCurrency, formatDate } from "@/lib/format";
import { buildPraticheHref } from "@/lib/dashboard/href";
import type { CaseCategory, CasePriority, CaseStatus } from "@/generated/prisma/enums";
import type { DashboardAlert } from "@/lib/dashboard/queries";

interface Option {
  id: string;
  name: string;
}

interface Chip {
  key: string;
  label: string;
  removeKeys: string[];
}

/**
 * Riepilogo dei filtri attivi come chip rimovibili singolarmente: quando un KPI o un campo
 * del form applica un filtro, deve restare visibile — mai solo nello stato nascosto della pagina.
 */
export function ActiveFiltersChips({
  filters,
  alerts,
  users,
  customers,
  suppliers,
}: {
  filters: Record<string, string | undefined>;
  alerts: DashboardAlert[];
  users: Option[];
  customers: Option[];
  suppliers: Option[];
}) {
  const chips: Chip[] = [];

  if (filters.quick) {
    const alert = alerts.find((a) => a.key === filters.quick);
    chips.push({ key: "quick", label: alert?.label ?? filters.quick, removeKeys: ["quick"] });
  }
  if (filters.category) {
    chips.push({
      key: "category",
      label: CASE_CATEGORY_LABELS[filters.category as CaseCategory],
      removeKeys: ["category"],
    });
  }
  if (filters.status) {
    chips.push({ key: "status", label: CASE_STATUS_LABELS[filters.status as CaseStatus], removeKeys: ["status"] });
  }
  if (filters.priority) {
    chips.push({
      key: "priority",
      label: `Priorità ${CASE_PRIORITY_LABELS[filters.priority as CasePriority]}`,
      removeKeys: ["priority"],
    });
  }
  if (filters.responsibleId) {
    const user = users.find((u) => u.id === filters.responsibleId);
    chips.push({ key: "responsibleId", label: `Responsabile: ${user?.name ?? "—"}`, removeKeys: ["responsibleId"] });
  }
  if (filters.customerId) {
    const customer = customers.find((c) => c.id === filters.customerId);
    chips.push({ key: "customerId", label: `Cliente: ${customer?.name ?? "—"}`, removeKeys: ["customerId"] });
  }
  if (filters.supplierId) {
    const supplier = suppliers.find((s) => s.id === filters.supplierId);
    chips.push({ key: "supplierId", label: `Fornitore: ${supplier?.name ?? "—"}`, removeKeys: ["supplierId"] });
  }
  if (filters.dateFrom || filters.dateTo) {
    const from = filters.dateFrom ? formatDate(filters.dateFrom) : null;
    const to = filters.dateTo ? formatDate(filters.dateTo) : null;
    const label =
      from && to
        ? `Pratica creata dal ${from} al ${to}`
        : from
          ? `Pratica creata dal ${from}`
          : `Pratica creata fino al ${to}`;
    chips.push({ key: "date", label, removeKeys: ["dateFrom", "dateTo"] });
  }
  if (filters.amountMin || filters.amountMax) {
    const min = filters.amountMin ? formatCurrency(Number(filters.amountMin)) : null;
    const max = filters.amountMax ? formatCurrency(Number(filters.amountMax)) : null;
    const label = min && max ? `Importo da ${min} a ${max}` : min ? `Importo minimo ${min}` : `Importo massimo ${max}`;
    chips.push({ key: "amount", label, removeKeys: ["amountMin", "amountMax"] });
  }
  if (filters.lowConfidence === "1") {
    chips.push({ key: "lowConfidence", label: "Bassa confidenza", removeKeys: ["lowConfidence"] });
  }
  if (filters.hasAttachments === "1") {
    chips.push({ key: "hasAttachments", label: "Con allegati", removeKeys: ["hasAttachments"] });
  }
  if (filters.overdue === "1") {
    chips.push({ key: "overdue", label: "Scaduto", removeKeys: ["overdue"] });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtri attivi">
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={buildPraticheHref(filters, Object.fromEntries(chip.removeKeys.map((k) => [k, null])))}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)]"
        >
          {chip.label}
          <X className="h-3.5 w-3.5 text-[var(--color-ink-muted)]" aria-hidden="true" />
        </Link>
      ))}
      <Link
        href="/pratiche"
        className="text-xs font-medium text-[var(--color-brand-dark)] hover:underline"
      >
        Rimuovi tutti i filtri
      </Link>
    </div>
  );
}
