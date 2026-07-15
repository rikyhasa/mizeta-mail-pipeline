import Link from "next/link";
import type { DashboardAlert } from "@/lib/dashboard/queries";

export function AlertsBand({ alerts, activeQuick }: { alerts: DashboardAlert[]; activeQuick?: string }) {
  return (
    <section aria-label="Avvisi">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {alerts.map((alert) => {
          const isActive = activeQuick === alert.key;
          return (
            <li key={alert.key}>
              <Link
                href={`/pratiche?quick=${alert.key}`}
                className={`flex h-full flex-col gap-1 rounded-lg border px-3 py-3 hover:border-slate-400 ${
                  isActive ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"
                }`}
              >
                <span className="text-2xl font-semibold">{alert.count}</span>
                <span className={`text-xs ${isActive ? "text-slate-200" : "text-slate-500"}`}>
                  {alert.label}
                  {isActive ? " (filtro attivo)" : ""}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
