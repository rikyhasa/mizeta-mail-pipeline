import Link from "next/link";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { CASE_CATEGORY_LABELS, GENERATED_DOCUMENT_TYPE_LABELS } from "@/lib/i18n/labels";
import { formatDate } from "@/lib/format";
import type { CaseCategory, GeneratedDocumentType } from "@/generated/prisma/enums";
import type { DocumentTemplateStats } from "@/lib/documents/report-queries";

/** Una card per modello (FASE 3, tappa 5): stesse misure di `.detail-panel`/`.box` già
 * stabilite. Onesta sullo stato reale — mai un bottone "Genera" qui: la generazione resta
 * per-pratica (`DocumentsCard.tsx`), questa pagina è solo un riepilogo con link reali verso le
 * pratiche pertinenti. Per i tipi senza generazione server-side implementata, badge "Non
 * ancora disponibile" invece di un conteggio o un'azione finta. */
export function TemplateCard({
  type,
  description,
  stats,
  category,
}: {
  type: GeneratedDocumentType;
  description: string;
  stats: DocumentTemplateStats | null;
  category: CaseCategory | null;
}) {
  return (
    <div className="detail-panel">
      <div className="flex items-start gap-3.5">
        <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-muted)] text-[var(--color-anthracite)]">
          <FileText className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-card-title font-semibold text-[var(--color-ink)]">{GENERATED_DOCUMENT_TYPE_LABELS[type]}</h2>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{description}</p>
          {category ? (
            <>
              <p className="mt-3 text-xs text-[var(--color-ink-muted)]">
                {stats && stats.count > 0
                  ? `${stats.count} generato/i, ultimo il ${formatDate(stats.lastGeneratedAt)}`
                  : "Nessuno generato finora"}
              </p>
              <Link
                href={`/pratiche?category=${category}`}
                className="mt-2 inline-block text-sm font-medium text-[var(--color-brand-dark)] hover:underline"
              >
                Vai alle pratiche {CASE_CATEGORY_LABELS[category]} →
              </Link>
            </>
          ) : (
            <div className="mt-3">
              <Badge tone="muted">Non ancora disponibile</Badge>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
