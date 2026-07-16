import { prisma } from "@/lib/db/prisma";
import { requireUserOrRedirect } from "@/lib/auth/guard";
import { getAlerts, getFilteredCases, getKpis, type DashboardFilters, type DashboardQuickFilter } from "@/lib/dashboard/queries";
import { PrimaryAlerts } from "./_components/PrimaryAlerts";
import { DashboardStatsStrip } from "./_components/DashboardStatsStrip";
import { FiltersBar } from "./_components/FiltersBar";
import { ActiveFiltersChips } from "./_components/ActiveFiltersChips";
import { CasesTable } from "@/components/cases/CasesTable";
import type { CaseCategory, CasePriority, CaseStatus } from "@/generated/prisma/enums";

type SearchParams = Record<string, string | undefined>;

function parseFilters(sp: SearchParams): DashboardFilters {
  return {
    q: sp.q || undefined,
    category: sp.category as CaseCategory | undefined,
    status: sp.status as CaseStatus | undefined,
    priority: sp.priority as CasePriority | undefined,
    responsibleId: sp.responsibleId || undefined,
    customerId: sp.customerId || undefined,
    supplierId: sp.supplierId || undefined,
    dateFrom: sp.dateFrom || undefined,
    dateTo: sp.dateTo || undefined,
    amountMin: sp.amountMin ? Number(sp.amountMin) : undefined,
    amountMax: sp.amountMax ? Number(sp.amountMax) : undefined,
    lowConfidence: sp.lowConfidence === "1",
    hasAttachments: sp.hasAttachments === "1",
    overdue: sp.overdue === "1",
    quick: sp.quick as DashboardQuickFilter | undefined,
    page: sp.page ? Number(sp.page) : 1,
  };
}

export default async function PraticheDashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireUserOrRedirect();
  const sp = await searchParams;
  const filters = parseFilters(sp);

  const [alerts, kpis, { items, total }, users, customers, suppliers] = await Promise.all([
    getAlerts(),
    getKpis(),
    getFilteredCases(filters),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.customer.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-page-title font-semibold text-[var(--color-ink)]">Pratiche</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Le email in arrivo diventano pratiche operative da controllare e completare.</p>
      </div>

      <PrimaryAlerts alerts={alerts} activeQuick={filters.quick} searchParams={sp} />
      <DashboardStatsStrip alerts={alerts} kpis={kpis} searchParams={sp} />
      <FiltersBar filters={sp} users={users} customers={customers} suppliers={suppliers} />
      <ActiveFiltersChips filters={sp} alerts={alerts} users={users} customers={customers} suppliers={suppliers} />
      <CasesTable items={items} total={total} page={filters.page ?? 1} searchParams={sp} />
    </div>
  );
}
