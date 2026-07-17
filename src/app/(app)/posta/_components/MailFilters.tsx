"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChangeEvent } from "react";
import { CASE_CATEGORY_LABELS } from "@/lib/i18n/labels";
import type { CaseCategory } from "@/generated/prisma/enums";

const selectClassName =
  "min-h-[44px] rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]";

/** Filtro categoria di "Posta acquisita" (FASE 3, rifinitura finale): applicato subito al
 * cambio, nessun bottone "Applica" — riusa `Case.category`, lo stesso dato già mostrato nella
 * colonna "Categoria" di `IncomingMailTable`, nessuna nuova query di dominio. */
export function MailFilters({ category }: { category: string | undefined }) {
  const router = useRouter();

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    router.push(value ? `/posta?category=${value}` : "/posta", { scroll: false });
  }

  return (
    <section aria-label="Filtri" className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white p-2.5">
      <select aria-label="Categoria" defaultValue={category ?? ""} onChange={handleChange} className={selectClassName}>
        <option value="">Tutte le categorie</option>
        {(Object.keys(CASE_CATEGORY_LABELS) as CaseCategory[]).map((c) => (
          <option key={c} value={c}>
            {CASE_CATEGORY_LABELS[c]}
          </option>
        ))}
      </select>
      {category && (
        <Link href="/posta" className="text-sm font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:underline">
          Azzera filtri
        </Link>
      )}
    </section>
  );
}
