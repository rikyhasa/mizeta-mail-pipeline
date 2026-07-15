"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RuleSettingsData } from "@/lib/rules/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { InactiveBadge } from "@/components/ui/Badge";
import { FormField, fieldControlClassName } from "@/components/ui/Field";
import { UnsavedChangesBar } from "@/components/ui/UnsavedChangesBar";

type AutomationFields = Pick<
  RuleSettingsData,
  | "classificationConfidenceThreshold"
  | "matchingAutoLinkConfidenceThreshold"
  | "matchingPossibleDuplicateConfidenceThreshold"
  | "deadlineCriticalWithinHours"
  | "fineReducedDeadlineCriticalWithinHours"
  | "claimAmountHighThreshold"
  | "quoteSameDayResponseWithinHours"
  | "amountMismatchTolerancePercent"
  | "emailRetentionDays"
  | "attachmentRetentionDays"
  | "auditLogRetentionDays"
>;

export function AutomationSettingsForm({ settings }: { settings: RuleSettingsData }) {
  const router = useRouter();
  const [form, setForm] = useState<AutomationFields>(settings);
  const [excludedSendersText, setExcludedSendersText] = useState(settings.excludedSenderPatterns.join("\n"));
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function numberField(key: keyof AutomationFields, label: string, step = 1, min = 0, max?: number) {
    return (
      <FormField label={label} htmlFor={`auto-${key}`}>
        <input
          id={`auto-${key}`}
          type="number"
          step={step}
          min={min}
          max={max}
          value={form[key] as number}
          onChange={(e) => {
            setForm((f) => ({ ...f, [key]: Number(e.target.value) }));
            setDirty(true);
            setSaved(false);
          }}
          className={fieldControlClassName}
        />
      </FormField>
    );
  }

  function nullableDaysField(key: "emailRetentionDays" | "attachmentRetentionDays" | "auditLogRetentionDays", label: string) {
    return (
      <FormField label={`${label} (giorni, vuoto = nessun limite)`} htmlFor={`auto-${key}`}>
        <input
          id={`auto-${key}`}
          type="number"
          min={1}
          value={form[key] ?? ""}
          onChange={(e) => {
            setForm((f) => ({ ...f, [key]: e.target.value === "" ? null : Number(e.target.value) }));
            setDirty(true);
            setSaved(false);
          }}
          className={fieldControlClassName}
        />
      </FormField>
    );
  }

  function handleCancel() {
    setForm(settings);
    setExcludedSendersText(settings.excludedSenderPatterns.join("\n"));
    setDirty(false);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const payload = {
        ...form,
        excludedSenderPatterns: excludedSendersText
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
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
      <Card padding="compact">
        <CardHeader title="Soglie di automazione" description="Confidenze e finestre temporali usate dalle regole automatiche della pipeline." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {numberField("classificationConfidenceThreshold", "Confidenza minima classificazione (0-1)", 0.01, 0, 1)}
          {numberField("matchingAutoLinkConfidenceThreshold", "Confidenza minima collegamento automatico (0-1)", 0.01, 0, 1)}
          {numberField("matchingPossibleDuplicateConfidenceThreshold", "Confidenza minima possibile duplicato (0-1)", 0.01, 0, 1)}
          {numberField("deadlineCriticalWithinHours", "Ore per scadenza critica", 1, 1)}
          {numberField("fineReducedDeadlineCriticalWithinHours", "Ore per multa a termine ridotto critica", 1, 1)}
          {numberField("claimAmountHighThreshold", "Soglia importo reclamo alto (EUR)", 1, 0)}
          {numberField("quoteSameDayResponseWithinHours", "Ore per risposta preventivo in giornata", 1, 1)}
          {numberField("amountMismatchTolerancePercent", "Tolleranza discordanza importi (%)", 1, 0)}
        </div>
      </Card>

      <Card padding="compact">
        <CardHeader title="Conservazione dati (retention)" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {nullableDaysField("emailRetentionDays", "Conservazione email")}
          {nullableDaysField("attachmentRetentionDays", "Conservazione allegati")}
          {nullableDaysField("auditLogRetentionDays", "Conservazione audit log")}
        </div>
      </Card>

      <Card padding="compact" variant="flat">
        <div className="mb-3 flex items-center gap-2">
          <InactiveBadge />
          <p className="text-xs text-[var(--color-ink-muted)]">
            Configurabile e salvato in questa fase, ma non ancora applicato automaticamente dalla pipeline.
          </p>
        </div>
        <FormField label="Mittenti/cartelle esclusi (uno per riga)" htmlFor="auto-excluded-senders">
          <textarea
            id="auto-excluded-senders"
            value={excludedSendersText}
            disabled
            aria-disabled="true"
            onChange={(e) => {
              setExcludedSendersText(e.target.value);
              setDirty(true);
              setSaved(false);
            }}
            rows={3}
            className={`${fieldControlClassName} cursor-not-allowed bg-white/60 text-[var(--color-ink-muted)]`}
          />
        </FormField>
      </Card>

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
