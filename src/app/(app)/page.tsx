import Link from "next/link";
import { requireUserOrRedirect } from "@/lib/auth/guard";
import { getAlerts, getDashboardWorkItems, getKpis } from "@/lib/dashboard/queries";
import { CasesTable } from "@/components/cases/CasesTable";
import { DashboardHeader } from "./_components/DashboardHeader";
import { DashboardKpiCards } from "./_components/DashboardKpiCards";
import { DashboardSecondaryStats } from "./_components/DashboardSecondaryStats";

export default async function DashboardPage() {
  const now = new Date();
  const [user, alerts, kpis, workItems] = await Promise.all([
    requireUserOrRedirect(),
    getAlerts(now),
    getKpis(now),
    getDashboardWorkItems(12),
  ]);

  const firstName = user.name.trim().split(/\s+/)[0] || user.name;

  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader firstName={firstName} isAdmin={user.role === "ADMIN"} now={now} />

      <DashboardKpiCards alerts={alerts} />

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-section-title font-semibold text-[var(--color-ink)]">Quadro operativo</h2>
          <p className="text-xs text-[var(--color-ink-muted)]">Dati reali, aggiornati a ogni apertura della pagina</p>
        </div>
        <DashboardSecondaryStats kpis={kpis} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-section-title font-semibold text-[var(--color-ink)]">Pratiche da lavorare</h2>
          <Link href="/pratiche" className="text-sm font-medium text-[var(--color-brand-dark)] hover:underline">
            Vedi tutte →
          </Link>
        </div>
        <CasesTable items={workItems} compact />
      </section>
    </div>
  );
}
