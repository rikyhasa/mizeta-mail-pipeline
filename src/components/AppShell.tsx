"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentType, type ReactNode } from "react";
import { ClipboardList, ListChecks, Settings, Menu, X, LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";

type NavItem = { href: string; label: string; icon: ComponentType<{ className?: string }> };

const NAV_ITEMS: NavItem[] = [
  { href: "/pratiche", label: "Pratiche", icon: ClipboardList },
  { href: "/revisione", label: "Coda di revisione", icon: ListChecks },
];

export function AppShell({
  userName,
  userRoleLabel,
  isAdmin,
  mockMode,
  children,
}: {
  userName: string;
  userRoleLabel: string;
  isAdmin: boolean;
  mockMode: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const items = isAdmin
    ? [...NAV_ITEMS, { href: "/impostazioni", label: "Impostazioni", icon: Settings }]
    : NAV_ITEMS;

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

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

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col bg-[var(--color-anthracite)] transition-transform lg:static lg:translate-x-0 ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Navigazione principale"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand)] text-sm font-bold text-white">
              M
            </span>
            <div>
              <div className="text-sm font-semibold text-[var(--color-sidebar-ink)]">Mizeta</div>
              <div className="text-[11px] tracking-wide text-[var(--color-sidebar-ink-muted)] uppercase">
                Mail Pipeline
              </div>
            </div>
          </div>
          <button
            type="button"
            className="rounded p-1 text-[var(--color-sidebar-ink-muted)] hover:bg-[var(--color-anthracite-light)] lg:hidden"
            onClick={() => setDrawerOpen(false)}
            aria-label="Chiudi il menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Sezioni">
          {items.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setDrawerOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] ${
                  active
                    ? "bg-[var(--color-anthracite-light)] text-white shadow-[inset_3px_0_0_var(--color-brand)]"
                    : "text-[var(--color-sidebar-ink-muted)] hover:bg-[var(--color-anthracite-light)] hover:text-[var(--color-sidebar-ink)]"
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3 border-t border-[var(--color-anthracite-border)] px-4 py-4">
          <Avatar name={userName} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--color-sidebar-ink)]">{userName}</p>
            <p className="truncate text-xs text-[var(--color-sidebar-ink-muted)]">{userRoleLabel}</p>
          </div>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              aria-label="Esci"
              title="Esci"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-sidebar-ink-muted)] hover:bg-[var(--color-anthracite-light)] hover:text-[var(--color-sidebar-ink)]"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-h-full min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[var(--color-border)] bg-white px-4 py-3 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Apri il menu di navigazione"
            className="rounded p-2 text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)] lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-[var(--color-anthracite)] lg:hidden">
            Mizeta Mail Pipeline
          </span>
          <div className="ml-auto flex items-center gap-3">
            {mockMode && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--color-forest)_14%,white)] px-2.5 py-1 text-xs font-medium text-[var(--color-forest)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-forest)]" aria-hidden="true" />
                Modalità mock
              </span>
            )}
          </div>
        </header>
        <main className="min-w-0 flex-1 bg-[var(--color-surface-muted)] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
