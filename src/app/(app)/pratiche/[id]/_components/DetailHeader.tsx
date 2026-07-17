import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { CASE_CATEGORY_LABELS } from "@/lib/i18n/labels";
import { CategoryIcon } from "@/lib/i18n/category-icons";
import { Badge } from "@/components/ui/Badge";
import { buttonClassName } from "@/components/ui/Button";
import { PrintButton } from "./PrintButton";
import type { CaseCategory } from "@/generated/prisma/enums";

/** Intestazione della pagina (Fase 8, rifinita in FASE 3 tappa 10 con Stampa/Genera PDF —
 * annotazione raccolta durante FASE 8B). "Genera PDF" compare solo se la categoria ha un
 * modello documento reale (`documentType`, stessa fonte usata da `DocumentsCard`): porta
 * all'azione di generazione già esistente in "Documenti generati" (`#documenti`), non
 * duplica la logica né finge una generazione per categorie non ancora implementate. */
export function DetailHeader({
  reference,
  category,
  title,
  isPec,
  documentTypeLabel,
}: {
  reference: string;
  category: CaseCategory;
  title: string;
  isPec: boolean;
  documentTypeLabel: string | undefined;
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
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <div className="flex shrink-0 gap-2 print:hidden">
          <PrintButton />
          {documentTypeLabel && (
            <Link href="#documenti" className={buttonClassName({ variant: "primary", size: "md" })}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Genera PDF
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
