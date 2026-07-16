import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CASE_CATEGORY_LABELS } from "@/lib/i18n/labels";
import { CategoryIcon } from "@/lib/i18n/category-icons";
import { Badge } from "@/components/ui/Badge";
import type { CaseCategory } from "@/generated/prisma/enums";

/** Intestazione della pagina (Fase 8): solo navigazione e identità della pratica — le
 * azioni si sono spostate nella colonna laterale "Azioni" o nelle singole sezioni. */
export function DetailHeader({
  reference,
  category,
  title,
  isPec,
}: {
  reference: string;
  category: CaseCategory;
  title: string;
  isPec: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Link
        href="/pratiche"
        className="inline-flex w-fit items-center gap-1 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Tutte le pratiche
      </Link>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-muted)] text-[var(--color-anthracite)]">
          <CategoryIcon category={category} className="h-5 w-5" />
        </span>
        <div>
          <p className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wide text-[var(--color-brand-dark)] uppercase">
            {reference} · {CASE_CATEGORY_LABELS[category]}
            {isPec && <Badge tone="info">PEC</Badge>}
          </p>
          <h1 className="text-page-title font-semibold text-[var(--color-ink)]">{title}</h1>
        </div>
      </div>
    </div>
  );
}
