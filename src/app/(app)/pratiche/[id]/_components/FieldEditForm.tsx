"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function FieldEditForm({ caseId, fieldKey, initialValue }: { caseId: string; fieldKey: string; initialValue: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/fields/${fieldKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Si è verificato un errore");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
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
        className="rounded border border-slate-300 px-2 py-1 text-xs"
      />
      <button type="submit" disabled={pending} className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50">
        {pending ? "..." : "Salva correzione"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </form>
  );
}
