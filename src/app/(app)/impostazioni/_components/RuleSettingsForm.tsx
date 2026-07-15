"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CASE_CATEGORY_LABELS, DEPARTMENT_LABELS } from "@/lib/i18n/labels";
import type { CaseCategory, Department } from "@/generated/prisma/enums";
import type { RuleSettingsData } from "@/lib/rules/types";

const CATEGORIES = Object.keys(CASE_CATEGORY_LABELS) as CaseCategory[];
const DEPARTMENTS = Object.keys(DEPARTMENT_LABELS) as Department[];

export function RuleSettingsForm({ settings }: { settings: RuleSettingsData }) {
  const router = useRouter();
  const [form, setForm] = useState(settings);
  const [excludedSendersText, setExcludedSendersText] = useState(settings.excludedSenderPatterns.join("\n"));
  const [enabledCategories, setEnabledCategories] = useState<Set<CaseCategory>>(
    new Set(settings.enabledCategories.length > 0 ? settings.enabledCategories : CATEGORIES),
  );
  const [departmentByCategory, setDepartmentByCategory] = useState<Partial<Record<CaseCategory, Department | "">>>(
    Object.fromEntries(CATEGORIES.map((c) => [c, settings.defaultDepartmentByCategory?.[c] ?? ""])),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function numberField(key: keyof RuleSettingsData, label: string, step = 1, min = 0, max?: number) {
    return (
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        {label}
        <input
          type="number"
          step={step}
          min={min}
          max={max}
          value={form[key] as number}
          onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
    );
  }

  function nullableDaysField(key: "emailRetentionDays" | "attachmentRetentionDays" | "auditLogRetentionDays", label: string) {
    return (
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        {label} (giorni, vuoto = nessun limite)
        <input
          type="number"
          min={1}
          value={form[key] ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value === "" ? null : Number(e.target.value) }))}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSavedAt(null);
    try {
      const departmentEntries = Object.entries(departmentByCategory).filter(([, v]) => v) as [CaseCategory, Department][];
      const payload = {
        ...form,
        excludedSenderPatterns: excludedSendersText
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
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
      setSavedAt(Date.now());
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Soglie</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {numberField("classificationConfidenceThreshold", "Confidenza minima classificazione (0-1)", 0.01, 0, 1)}
          {numberField("matchingAutoLinkConfidenceThreshold", "Confidenza minima collegamento automatico (0-1)", 0.01, 0, 1)}
          {numberField("matchingPossibleDuplicateConfidenceThreshold", "Confidenza minima possibile duplicato (0-1)", 0.01, 0, 1)}
          {numberField("deadlineCriticalWithinHours", "Ore per scadenza critica", 1, 1)}
          {numberField("fineReducedDeadlineCriticalWithinHours", "Ore per multa a termine ridotto critica", 1, 1)}
          {numberField("claimAmountHighThreshold", "Soglia importo reclamo alto (EUR)", 1, 0)}
          {numberField("quoteSameDayResponseWithinHours", "Ore per risposta preventivo in giornata", 1, 1)}
          {numberField("amountMismatchTolerancePercent", "Tolleranza discordanza importi (%)", 1, 0)}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Retention</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {nullableDaysField("emailRetentionDays", "Conservazione email")}
          {nullableDaysField("attachmentRetentionDays", "Conservazione allegati")}
          {nullableDaysField("auditLogRetentionDays", "Conservazione audit log")}
        </div>
        <label className="mt-3 flex flex-col gap-1 text-xs text-slate-600">
          Mittenti/cartelle esclusi (uno per riga)
          <textarea
            value={excludedSendersText}
            onChange={(e) => setExcludedSendersText(e.target.value)}
            rows={3}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <p className="mt-1 text-xs text-slate-400">Configurabile in questa fase; non ancora applicato automaticamente (Fase 4/5).</p>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Categorie abilitate</h3>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {CATEGORIES.map((c) => (
            <label key={c} className="flex items-center gap-1.5 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={enabledCategories.has(c)}
                onChange={(e) =>
                  setEnabledCategories((prev) => {
                    const next = new Set(prev);
                    if (e.target.checked) next.add(c);
                    else next.delete(c);
                    return next;
                  })
                }
              />
              {CASE_CATEGORY_LABELS[c]}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-400">Configurabile in questa fase; non ancora applicato dalla pipeline (Fase 4/5).</p>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Reparto predefinito per categoria</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CATEGORIES.map((c) => (
            <label key={c} className="flex flex-col gap-1 text-xs text-slate-600">
              {CASE_CATEGORY_LABELS[c]}
              <select
                value={departmentByCategory[c] ?? ""}
                onChange={(e) => setDepartmentByCategory((prev) => ({ ...prev, [c]: e.target.value as Department | "" }))}
                className="rounded border border-slate-300 px-2 py-1.5 text-sm"
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
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
          {pending ? "Salvataggio..." : "Salva impostazioni"}
        </button>
        {savedAt && <span className="text-xs text-emerald-700">Impostazioni salvate.</span>}
        {error && (
          <span role="alert" className="text-xs text-red-600">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
