import Link from "next/link";
import { Mail } from "lucide-react";
import { buttonClassName } from "@/components/ui/Button";
import { formatWeekdayDate } from "@/lib/format";

/**
 * Intestazione dashboard (reference: eyebrow + saluto + azione principale).
 * Saluto e data sono sempre calcolati dalla sessione/orologio reali — mai
 * valori fissi come nella reference ("Buongiorno, Elena" / "Martedì 14
 * luglio", Fase 8, docs/UI-PORTING-PLAN.md). Il target non ha un'azione di
 * sincronizzazione generica: per ADMIN un link reale alle connessioni email
 * (dove il sync per-mailbox esiste davvero), nessun bottone per gli altri
 * ruoli — mai un bottone che finge un'azione senza handler.
 */
export function DashboardHeader({
  firstName,
  isAdmin,
  now,
}: {
  firstName: string;
  isAdmin: boolean;
  now: Date;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold tracking-wide text-[var(--color-brand-dark)] capitalize">
          {formatWeekdayDate(now)}
        </p>
        <h1 className="text-page-title font-semibold text-[var(--color-ink)]">Buongiorno, {firstName}</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Ecco cosa richiede attenzione nelle attività di oggi.</p>
      </div>
      {isAdmin && (
        <Link href="/impostazioni" className={buttonClassName({ variant: "primary", size: "md" })}>
          <Mail className="h-4 w-4" aria-hidden="true" />
          Connessioni email
        </Link>
      )}
    </div>
  );
}
