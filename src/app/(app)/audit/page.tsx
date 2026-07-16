import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { requireUserOrRedirect } from "@/lib/auth/guard";
import { getAuditLogEntries } from "@/lib/audit/queries";
import { Badge } from "@/components/ui/Badge";
import { buttonClassName } from "@/components/ui/Button";
import { PAGE_SIZE } from "@/lib/dashboard/constants";
import { AuditLogTable } from "./_components/AuditLogTable";

function pageHref(page: number): string {
  return `/audit?page=${page}`;
}

/** "Registro attività" (FASE 3, tappa 6): a differenza della reference (30 eventi mock fissi,
 * colonna "Dettaglio" scritta a mano), qui `AuditLog` è reale e append-only (CLAUDE.md
 * invariante 7) — il badge "Audit integro" non è decorativo come nella reference, riflette
 * una garanzia architetturale vera: nessuna rotta di modifica/cancellazione esiste per questa
 * tabella. Paginato come `/posta`, perché il volume reale cresce nel tempo. */
export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireUserOrRedirect();
  const sp = await searchParams;
  const page = sp.page ? Math.max(1, Number(sp.page)) : 1;

  const { items, total } = await getAuditLogEntries(page);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-[var(--color-brand)] uppercase">Tracciabilità</p>
          <h1 className="mt-1 text-page-title font-semibold text-[var(--color-ink)]">Registro attività</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Eventi importanti append-only, senza corpi email, segreti o token.
          </p>
        </div>
        <Badge tone="success" icon={ShieldCheck}>
          Audit integro
        </Badge>
      </div>

      <AuditLogTable items={items} />

      {totalPages > 1 && (
        <nav aria-label="Paginazione" className="flex items-center justify-between text-sm text-[var(--color-ink-muted)]">
          <span>
            Pagina {page} di {totalPages} — {total} eventi totali
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={pageHref(page - 1)} className={buttonClassName({ variant: "secondary", size: "sm" })}>
                ← Precedente
              </Link>
            )}
            {page < totalPages && (
              <Link href={pageHref(page + 1)} className={buttonClassName({ variant: "secondary", size: "sm" })}>
                Successiva →
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}

export const dynamic = "force-dynamic";
