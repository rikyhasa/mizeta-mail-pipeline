import type { ComponentType } from "react";
import {
  ClipboardList,
  Truck,
  Receipt,
  Euro,
  Bell,
  Gavel,
  AlertTriangle,
  FileText,
  Mail,
  Building2,
  Folder,
  HelpCircle,
} from "lucide-react";
import type { CaseCategory } from "@/generated/prisma/enums";
import { CASE_CATEGORY_LABELS } from "@/lib/i18n/labels";

/** Icona coerente per categoria (SPEC.md §19): stessa icona ovunque, mai l'unico indicatore. */
export const CASE_CATEGORY_ICONS: Record<CaseCategory, ComponentType<{ className?: string }>> = {
  QUOTE_REQUEST: ClipboardList,
  TRANSPORT_ORDER: Truck,
  SUPPLIER_INVOICE: Receipt,
  CUSTOMER_RECEIVABLE: Euro,
  PAYMENT_NOTICE: Bell,
  FINE_OR_PENALTY: Gavel,
  CLAIM_OR_DAMAGE: AlertTriangle,
  TRANSPORT_DOCUMENT: FileText,
  CUSTOMER_COMMUNICATION: Mail,
  ADMINISTRATIVE: Building2,
  OTHER: Folder,
  UNCERTAIN: HelpCircle,
};

/**
 * Icona di categoria accessibile: l'icona è decorativa (`aria-hidden`), l'etichetta va sempre
 * mostrata a fianco dal chiamante — mai un'informazione veicolata solo dall'icona/colore.
 */
export function CategoryIcon({ category, className = "h-4 w-4" }: { category: CaseCategory; className?: string }) {
  const Icon = CASE_CATEGORY_ICONS[category];
  return <Icon className={className} aria-hidden="true" />;
}

export function CategoryBadge({ category }: { category: CaseCategory }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <CategoryIcon category={category} />
      <span>{CASE_CATEGORY_LABELS[category]}</span>
    </span>
  );
}
