"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { buttonClassName } from "@/components/ui/Button";
import { fieldControlClassName } from "@/components/ui/Field";

export function FieldEditForm({ caseId, fieldKey, initialValue }: { caseId: string; fieldKey: string; initialValue: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
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
      setEditing(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={buttonClassName({ variant: "tertiary", size: "sm" })}
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        Modifica
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
