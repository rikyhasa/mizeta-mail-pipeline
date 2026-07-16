import type { ComponentType, ReactNode } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  Minus,
  ArrowDown,
  Search,
  UserCheck,
  Clock,
  Hourglass,
  CheckCircle2,
  Archive,
  Sparkles,
  Ban,
} from "lucide-react";
import type { CasePriority, CaseStatus } from "@/generated/prisma/enums";
import { CASE_PRIORITY_LABELS, CASE_STATUS_LABELS } from "@/lib/i18n/labels";

export type BadgeTone = "neutral" | "critical" | "warning" | "success" | "info" | "muted";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  critical:
    "bg-[var(--color-critical-soft)] text-[var(--color-critical)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--color-critical)_30%,white)]",
  warning:
    "bg-[var(--color-warning-soft)] text-[var(--color-warning)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--color-warning)_30%,white)]",
  success: "bg-[color-mix(in_srgb,var(--color-forest)_14%,white)] text-[var(--color-forest)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--color-forest)_35%,white)]",
  info: "bg-[color-mix(in_srgb,var(--color-teal)_12%,white)] text-[var(--color-teal)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--color-teal)_30%,white)]",
  muted: "bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200",
};

/**
 * Pillola di stato/priorità: colore + icona + etichetta testuale sempre insieme.
 * Nessuna informazione va veicolata dal solo colore (SPEC.md §19).
 */
export function Badge({
  tone = "neutral",
  icon: Icon,
  children,
}: {
  tone?: BadgeTone;
  icon?: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${TONE_CLASSES[tone]}`}
    >
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      {children}
    </span>
  );
}

const PRIORITY_CONFIG: Record<CasePriority, { tone: BadgeTone; icon: ComponentType<{ className?: string }> }> = {
  CRITICAL: { tone: "critical", icon: AlertOctagon },
  HIGH: { tone: "warning", icon: AlertTriangle },
  NORMAL: { tone: "neutral", icon: Minus },
  LOW: { tone: "muted", icon: ArrowDown },
};

export function PriorityBadge({ priority }: { priority: CasePriority }) {
  const { tone, icon } = PRIORITY_CONFIG[priority];
  return (
    <Badge tone={tone} icon={icon}>
      {CASE_PRIORITY_LABELS[priority]}
    </Badge>
  );
}

const STATUS_CONFIG: Record<CaseStatus, { tone: BadgeTone; icon: ComponentType<{ className?: string }> }> = {
  NEW: { tone: "info", icon: Sparkles },
  NEEDS_REVIEW: { tone: "warning", icon: Search },
  ASSIGNED: { tone: "info", icon: UserCheck },
  IN_PROGRESS: { tone: "info", icon: Clock },
  WAITING_CUSTOMER: { tone: "muted", icon: Hourglass },
  WAITING_INTERNAL: { tone: "muted", icon: Hourglass },
  COMPLETED: { tone: "success", icon: CheckCircle2 },
  ARCHIVED: { tone: "muted", icon: Archive },
};

export function StatusBadge({ status }: { status: CaseStatus }) {
  const { tone, icon } = STATUS_CONFIG[status];
  return (
    <Badge tone={tone} icon={icon}>
      {CASE_STATUS_LABELS[status]}
    </Badge>
  );
}

export function InactiveBadge({ children = "Non ancora attivo" }: { children?: ReactNode }) {
  return (
    <Badge tone="muted" icon={Ban}>
      {children}
    </Badge>
  );
}
