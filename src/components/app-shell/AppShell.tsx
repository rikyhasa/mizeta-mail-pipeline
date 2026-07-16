"use client";

import { useState, type ReactNode } from "react";
import type { ProviderStatusSummary } from "@/lib/observability/provider-status";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({
  userName,
  userRoleLabel,
  isAdmin,
  providerStatus,
  children,
}: {
  userName: string;
  userRoleLabel: string;
  isAdmin: boolean;
  providerStatus: ProviderStatusSummary;
  children: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-full flex-1">
      {drawerOpen && (
        <button
          type="button"
          aria-label="Chiudi il menu"
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <Sidebar
        userName={userName}
        userRoleLabel={userRoleLabel}
        isAdmin={isAdmin}
        drawerOpen={drawerOpen}
        onCloseDrawer={() => setDrawerOpen(false)}
      />

      <div className="flex min-h-full min-w-0 flex-1 flex-col">
        <Topbar providerStatus={providerStatus} onOpenDrawer={() => setDrawerOpen(true)} />
        <main className="min-w-0 flex-1 bg-[var(--color-surface-muted)]">
          <div className="mx-auto max-w-[1540px] px-4 py-6 sm:px-6 lg:px-8 lg:py-[30px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
