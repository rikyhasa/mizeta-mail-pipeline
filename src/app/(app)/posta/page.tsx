import Link from "next/link";
import { requireUserOrRedirect } from "@/lib/auth/guard";
import { getIncomingMessages } from "@/lib/mail/inbox-queries";
import { buttonClassName } from "@/components/ui/Button";
import { PAGE_SIZE } from "@/lib/dashboard/constants";
import { CASE_CATEGORY_LABELS } from "@/lib/i18n/labels";
import type { CaseCategory } from "@/generated/prisma/enums";
import { IncomingMailTable } from "./_components/IncomingMailTable";
import { MailFilters } from "./_components/MailFilters";

function pageHref(page: number, category: CaseCategory | undefined): string {
  const params = new URLSearchParams({ page: String(page) });
  if (category) params.set("category", category);
  return `/posta?${params.toString()}`;
}

function parseCategory(raw: string | undefined): CaseCategory | undefined {
  return raw && raw in CASE_CATEGORY_LABELS ? (raw as CaseCategory) : undefined;
}

/** "Posta acquisita" (FASE 3, tappa 2 + rifinitura finale): a differenza della reference —
 * tabella statica su 26 email mock, nessun filtro/paginazione — qui i dati sono reali
 * (`EmailMessage` INBOUND) e il volume cresce nel tempo, quindi servono paginazione (stesso
 * `PAGE_SIZE` di `/pratiche`) e, dalla rifinitura finale, un filtro per categoria applicato
 * subito al cambio (`MailFilters.tsx`) — riusa `Case.category`, già mostrata in tabella. La
 * reference mostra una pillola di stato anche qui oltre che in topbar, ma con testo diverso
 * (mailbox vs provider aggregato); nel target userebbero la stessa funzione/lo stesso dato —
 * comparirebbe due volte lo stesso testo identico. Rimossa qui: il topbar (presente su ogni
 * pagina) già la mostra. */
export default async function PostaAcquisitaPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; category?: string }>;
}) {
  await requireUserOrRedirect();
  const sp = await searchParams;
  const page = sp.page ? Math.max(1, Number(sp.page)) : 1;
  const category = parseCategory(sp.category);

  const { items, total, confidenceThreshold } = await getIncomingMessages(page, category);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold tracking-wide text-[var(--color-brand)] uppercase">Casella in sola lettura</p>
        <h1 className="mt-1 text-page-title font-semibold text-[var(--color-ink)]">Posta acquisita</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          {total} messaggio/i ricevuto/i, nessun invio abilitato.
        </p>
      </div>

      <MailFilters category={category} />

      <IncomingMailTable items={items} confidenceThreshold={confidenceThreshold} />

      {totalPages > 1 && (
        <nav aria-label="Paginazione" className="flex items-center justify-between text-sm text-[var(--color-ink-muted)]">
          <span>
            Pagina {page} di {totalPages} — {total} messaggi totali
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={pageHref(page - 1, category)} className={buttonClassName({ variant: "secondary", size: "sm" })}>
                ← Precedente
              </Link>
            )}
            {page < totalPages && (
              <Link href={pageHref(page + 1, category)} className={buttonClassName({ variant: "secondary", size: "sm" })}>
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
