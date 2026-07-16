import Link from "next/link";
import { requireUserOrRedirect } from "@/lib/auth/guard";
import { getIncomingMessages } from "@/lib/mail/inbox-queries";
import { buttonClassName } from "@/components/ui/Button";
import { PAGE_SIZE } from "@/lib/dashboard/constants";
import { IncomingMailTable } from "./_components/IncomingMailTable";

function pageHref(page: number): string {
  return `/posta?page=${page}`;
}

/** "Posta acquisita" (FASE 3, tappa 2): a differenza della reference — tabella statica su
 * 26 email mock, nessun filtro/paginazione — qui i dati sono reali (`EmailMessage`
 * INBOUND) e il volume cresce nel tempo, quindi serve paginazione (stesso `PAGE_SIZE` di
 * `/pratiche`). Nessun filtro aggiuntivo rispetto alla reference: la composizione resta
 * quella — intestazione + singolo pannello tabella. La reference mostra una pillola di stato
 * anche qui oltre che in topbar, ma con testo diverso (mailbox vs provider aggregato); nel
 * target userebbero la stessa funzione/lo stesso dato — comparirebbe due volte lo stesso
 * testo identico. Rimossa qui: il topbar (presente su ogni pagina) già la mostra. */
export default async function PostaAcquisitaPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireUserOrRedirect();
  const sp = await searchParams;
  const page = sp.page ? Math.max(1, Number(sp.page)) : 1;

  const { items, total, confidenceThreshold } = await getIncomingMessages(page);
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

      <IncomingMailTable items={items} confidenceThreshold={confidenceThreshold} />

      {totalPages > 1 && (
        <nav aria-label="Paginazione" className="flex items-center justify-between text-sm text-[var(--color-ink-muted)]">
          <span>
            Pagina {page} di {totalPages} — {total} messaggi totali
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
