import type { ReactNode } from "react";
import { CategoryIcon } from "@/lib/i18n/category-icons";
import { CASE_CATEGORY_LABELS, CASE_RELATION_KIND_LABELS } from "@/lib/i18n/labels";
import { PriorityBadge } from "@/components/ui/Badge";
import { primaryReason } from "../_lib/review-reasons";
import type { QueueItem } from "./types";

/** Colonna sinistra della split-view: righe compatte, un solo badge di priorita al massimo,
 * motivo principale come frase normale (non un badge) — Fase 7C. */
export function ReviewList({
  items,
  selectedId,
  onSelect,
}: {
  items: QueueItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const relations = items.filter((i): i is Extract<QueueItem, { itemType: "relation" }> => i.itemType === "relation");
  const cases = items.filter((i): i is Extract<QueueItem, { itemType: "case" }> => i.itemType === "case");

  return (
    <div className="flex flex-col gap-5">
      {relations.length > 0 && (
        <div>
          <h2 className="mb-2 px-1 text-xs font-semibold tracking-wide text-[var(--color-ink-muted)] uppercase">
            Duplicati da verificare
          </h2>
          <ul className="flex flex-col gap-1.5">
            {relations.map((r) => (
              <QueueRow key={r.id} active={r.id === selectedId} onClick={() => onSelect(r.id)}>
                <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-ink-muted)]">
                  <CategoryIcon category={r.source.category} className="h-3.5 w-3.5" />
                  {CASE_RELATION_KIND_LABELS[r.relationKind]}
                </span>
                <p className="mt-1 text-sm font-medium text-[var(--color-ink)]">
                  {r.source.reference} · {r.target.reference}
                </p>
                <p className="mt-1 text-xs text-[var(--color-ink-muted)]">{r.reason ?? "Segnalato dalla pipeline"}</p>
              </QueueRow>
            ))}
          </ul>
        </div>
      )}

      {cases.length > 0 && (
        <div>
          <h2 className="mb-2 px-1 text-xs font-semibold tracking-wide text-[var(--color-ink-muted)] uppercase">
            Pratiche da verificare
          </h2>
          <ul className="flex flex-col gap-1.5">
            {cases.map((c) => {
              const reason = primaryReason(c.reasons);
              return (
                <QueueRow key={c.id} active={c.id === selectedId} onClick={() => onSelect(c.id)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-ink-muted)]">
                      <CategoryIcon category={c.category} className="h-3.5 w-3.5" />
                      {CASE_CATEGORY_LABELS[c.category]}
                    </span>
                    <PriorityBadge priority={c.priority} />
                  </div>
                  <p className="mt-1 text-sm font-medium text-[var(--color-ink)]">
                    {c.reference} — {c.title}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-ink-muted)]">
                    {reason.icon}
                    {reason.text}
                  </p>
                </QueueRow>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function QueueRow({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={`block w-full rounded-lg border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] ${
          active
            ? "border-[var(--color-brand)] bg-[color-mix(in_srgb,var(--color-brand)_6%,white)]"
            : "border-[var(--color-border)] bg-white hover:border-[var(--color-brand)]"
        }`}
      >
        {children}
      </button>
    </li>
  );
}
