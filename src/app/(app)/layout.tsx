import Link from "next/link";
import { requireUserOrRedirect } from "@/lib/auth/guard";
import { ROLE_LABELS } from "@/lib/i18n/labels";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUserOrRedirect();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold text-slate-900">Mizeta Mail Pipeline</span>
          <nav className="flex items-center gap-4 text-sm text-slate-600" aria-label="Navigazione principale">
            <Link href="/pratiche" className="hover:text-slate-900 hover:underline">
              Pratiche
            </Link>
            <Link href="/revisione" className="hover:text-slate-900 hover:underline">
              Coda di revisione
            </Link>
            {user.role === "ADMIN" && (
              <Link href="/impostazioni" className="hover:text-slate-900 hover:underline">
                Impostazioni
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-600">
          <span>
            {user.name} <span className="text-slate-400">·</span>{" "}
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="text-slate-500 underline hover:text-slate-900">
              Esci
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 bg-slate-50 px-6 py-6">{children}</main>
    </div>
  );
}
