"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { buttonClassName } from "@/components/ui/Button";
import { fieldControlClassName } from "@/components/ui/Field";

export function FieldEditForm({
  caseId,
  fieldKey,
  initialValue,
  endpointBase,
  triggerLabel,
}: {
  caseId: string;
  fieldKey: string;
  initialValue: string;
  /** Radice dell'endpoint da usare al posto del default `/api/cases/${caseId}/fields`, per
   * riusare questo form anche su EnforcementDeviceField (Tappa 6). */
  endpointBase?: string;
  /** Quando fornito, il toggle "modifica" diventa un bottone testuale prominente invece della
   * sola icona a matita — usato sui campi vuoti (H8/docs/UX-AUDIT-2026-07.md: mai un bottone
   * "Conferma" su un valore assente, l'azione utile lì è inserirlo). */
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = endpointBase ?? `/api/cases/${caseId}/fields`;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${base}/${fieldKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Si è verificato un errore");
        return;
      }
      setEditing(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (!editing) {
    if (triggerLabel) {
      return (
        <button type="button" onClick={() => setEditing(true)} className={buttonClassName({ variant: "secondary", size: "sm" })}>
          {triggerLabel}
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="Modifica valore"
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]"
      >
        <Pencil className="h-4 w-4" aria-hidden="true" />
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`field-${fieldKey}`}>
        Correggi valore
      </label>
      <input
        id={`field-${fieldKey}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={fieldControlClassName}
        autoFocus
      />
      <button type="submit" disabled={pending} className={buttonClassName({ variant: "primary", size: "sm" })}>
        {pending ? "..." : "Salva correzione"}
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setValue(initialValue);
          setError(null);
        }}
        className={buttonClassName({ variant: "tertiary", size: "sm" })}
      >
        Annulla
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </form>
  );
}
