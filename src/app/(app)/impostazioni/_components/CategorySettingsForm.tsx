"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CASE_CATEGORY_LABELS, DEPARTMENT_LABELS } from "@/lib/i18n/labels";
import type { CaseCategory, Department } from "@/generated/prisma/enums";
import type { RuleSettingsData } from "@/lib/rules/types";
import { WorkPanel } from "@/components/ui/WorkPanel";
import { InactiveBadge } from "@/components/ui/Badge";
import { fieldControlClassName } from "@/components/ui/Field";
import { UnsavedChangesBar } from "@/components/ui/UnsavedChangesBar";

const CATEGORIES = Object.keys(CASE_CATEGORY_LABELS) as CaseCategory[];
const DEPARTMENTS = Object.keys(DEPARTMENT_LABELS) as Department[];

export function CategorySettingsForm({ settings }: { settings: RuleSettingsData }) {
  const router = useRouter();
  const initialEnabled = new Set(settings.enabledCategories.length > 0 ? settings.enabledCategories : CATEGORIES);
  const initialDepartments = Object.fromEntries(CATEGORIES.map((c) => [c, settings.defaultDepartmentByCategory?.[c] ?? ""]));

  const [enabledCategories, setEnabledCategories] = useState<Set<CaseCategory>>(initialEnabled);
  const [departmentByCategory, setDepartmentByCategory] = useState<Partial<Record<CaseCategory, Department | "">>>(initialDepartments);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleCancel() {
    setEnabledCategories(new Set(initialEnabled));
    setDepartmentByCategory(initialDepartments);
    setDirty(false);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const departmentEntries = Object.entries(departmentByCategory).filter(([, v]) => v) as [CaseCategory, Department][];
      const payload = {
        enabledCategories: enabledCategories.size === CATEGORIES.length ? [] : [...enabledCategories],
        defaultDepartmentByCategory: departmentEntries.length > 0 ? Object.fromEntries(departmentEntries) : null,
      };
      const res = await fetch("/api/settings/rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Si è verificato un errore");
        return;
      }
      setDirty(false);
      setSaved(true);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <WorkPanel title="Categorie abilitate" action={<InactiveBadge />}>
        <p className="mb-3 text-xs text-[var(--color-ink-muted)]">Configurabile e salvato in questa fase, ma non ancora applicato dalla pipeline.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CATEGORIES.map((c) => (
            <label key={c} className="flex min-h-[36px] cursor-not-allowed items-center gap-2 text-sm text-[var(--color-ink-muted)]">
              <input
                type="checkbox"
                checked={enabledCategories.has(c)}
                disabled
                aria-disabled="true"
                onChange={(e) => {
                  setEnabledCategories((prev) => {
                    const next = new Set(prev);
                    if (e.target.checked) next.add(c);
                    else next.delete(c);
                    return next;
                  });
                  setDirty(true);
                  setSaved(false);
                }}
                className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-brand)] disabled:cursor-not-allowed"
              />
              {CASE_CATEGORY_LABELS[c]}
            </label>
          ))}
        </div>
      </WorkPanel>

      <WorkPanel title="Reparto predefinito per categoria">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CATEGORIES.map((c) => (
            <label key={c} className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-[var(--color-ink)]">{CASE_CATEGORY_LABELS[c]}</span>
              <select
                value={departmentByCategory[c] ?? ""}
                onChange={(e) => {
                  setDepartmentByCategory((prev) => ({ ...prev, [c]: e.target.value as Department | "" }));
                  setDirty(true);
                  setSaved(false);
                }}
                className={fieldControlClassName}
              >
                <option value="">Predefinito</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {DEPARTMENT_LABELS[d]}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </WorkPanel>

      <UnsavedChangesBar
        visible={dirty}
        pending={pending}
        error={error}
        onCancel={handleCancel}
        savedMessage={saved ? "Impostazioni salvate." : undefined}
      />
    </form>
  );
}
