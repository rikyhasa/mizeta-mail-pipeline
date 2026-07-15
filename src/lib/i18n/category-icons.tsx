import type { CaseCategory } from "@/generated/prisma/enums";
import { CASE_CATEGORY_LABELS } from "@/lib/i18n/labels";

/** Emoji per categoria (SPEC.md §19): mai l'unico indicatore, sempre accoppiata al testo. */
export const CASE_CATEGORY_EMOJI: Record<CaseCategory, string> = {
  QUOTE_REQUEST: "📋",
  TRANSPORT_ORDER: "🚚",
  SUPPLIER_INVOICE: "🧾",
  CUSTOMER_RECEIVABLE: "💶",
  PAYMENT_NOTICE: "🔔",
  FINE_OR_PENALTY: "🚨",
  CLAIM_OR_DAMAGE: "⚠️",
  TRANSPORT_DOCUMENT: "📄",
  CUSTOMER_COMMUNICATION: "✉️",
  ADMINISTRATIVE: "🏢",
  OTHER: "📁",
  UNCERTAIN: "❓",
};

/**
 * Icona di categoria accessibile: l'emoji è decorativa (`aria-hidden`), l'etichetta va sempre
 * mostrata a fianco dal chiamante — mai un'informazione veicolata solo dall'icona/colore.
 */
export function CategoryIcon({ category, className }: { category: CaseCategory; className?: string }) {
  return (
    <span aria-hidden="true" className={className}>
      {CASE_CATEGORY_EMOJI[category]}
    </span>
  );
}

export function CategoryBadge({ category }: { category: CaseCategory }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <CategoryIcon category={category} />
      <span>{CASE_CATEGORY_LABELS[category]}</span>
    </span>
  );
}
