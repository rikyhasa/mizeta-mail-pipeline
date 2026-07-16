"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { NAV_ITEMS, ADMIN_NAV_ITEM } from "./nav-items";

export function Sidebar({
  userName,
  userRoleLabel,
  isAdmin,
  drawerOpen,
  onCloseDrawer,
}: {
  userName: string;
  userRoleLabel: string;
  isAdmin: boolean;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
}) {
  const pathname = usePathname();
  const items = isAdmin ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS;

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
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
            <div className="text-[11px] tracking-wide text-[var(--color-sidebar-ink-subtle)] uppercase">Mail Pipeline</div>
          </div>
        </div>
        <button
          type="button"
          className="rounded p-1 text-[var(--color-sidebar-ink-muted)] hover:bg-[var(--color-anthracite-light)] lg:hidden"
          onClick={onCloseDrawer}
          aria-label="Chiudi il menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Sezioni">
        {items.map((item) => {
          const Icon = item.icon;

          if (item.status === "disabled") {
            return (
              <span
                key={item.href}
                aria-disabled="true"
                className="flex min-h-[44px] flex-col justify-center gap-0.5 rounded-lg px-3 py-1.5 text-[var(--color-sidebar-ink-subtle)] opacity-70"
              >
                <span className="flex items-center gap-3 text-sm font-medium">
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  {item.label}
                </span>
                <span className="pl-8 text-[10px] font-semibold tracking-wide uppercase">Non ancora disponibile</span>
              </span>
            );
          }

          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onCloseDrawer}
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
  );
}
