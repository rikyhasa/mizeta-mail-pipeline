"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentType, type ReactNode } from "react";
import { ClipboardList, ListChecks, Settings, Menu, X, LogOut } from "lucide-react";

type NavItem = { href: string; label: string; icon: ComponentType<{ className?: string }> };

const NAV_ITEMS: NavItem[] = [
  { href: "/pratiche", label: "Pratiche", icon: ClipboardList },
  { href: "/revisione", label: "Coda di revisione", icon: ListChecks },
];

export function AppShell({
  userName,
  userRoleLabel,
  isAdmin,
  children,
}: {
  userName: string;
  userRoleLabel: string;
  isAdmin: boolean;
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
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-white transition-transform lg:static lg:translate-x-0 ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Navigazione principale"
      >
        <div className="flex items-center justify-between px-5 py-5">
          <span className="text-base font-semibold text-[var(--color-anthracite)]">Mizeta</span>
          <button
            type="button"
            className="rounded p-1 text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)] lg:hidden"
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
                    ? "bg-[color-mix(in_srgb,var(--color-brand)_12%,white)] text-[var(--color-brand-dark)]"
                    : "text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[var(--color-border)] px-4 py-4">
          <p className="truncate text-sm font-medium text-[var(--color-ink)]">{userName}</p>
          <p className="text-xs text-[var(--color-ink-muted)]">{userRoleLabel}</p>
          <form action="/api/auth/logout" method="POST" className="mt-2">
            <button
              type="submit"
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Esci
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-h-full flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-[var(--color-border)] bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Apri il menu di navigazione"
            className="rounded p-2 text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)]"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-[var(--color-anthracite)]">Mizeta Mail Pipeline</span>
        </header>
        <main className="flex-1 bg-[var(--color-surface-muted)] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
