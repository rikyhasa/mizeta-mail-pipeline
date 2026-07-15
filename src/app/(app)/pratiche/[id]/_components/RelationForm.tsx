"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormField, fieldControlClassName } from "@/components/ui/Field";
import { buttonClassName } from "@/components/ui/Button";

export function RelationForm({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [targetReference, setTargetReference] = useState("");
  const [kind, setKind] = useState<"DUPLICATE_CANDIDATE" | "RELATED">("RELATED");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/relations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetReference, kind }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Si è verificato un errore");
        return;
      }
      setTargetReference("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <FormField label="Riferimento pratica da collegare" htmlFor="relation-target">
        <input
          id="relation-target"
          value={targetReference}
          onChange={(e) => setTargetReference(e.target.value)}
          required
          placeholder="es. PRT-2026-0009"
          className={fieldControlClassName}
        />
      </FormField>
      <FormField label="Tipo" htmlFor="relation-kind">
        <select id="relation-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={fieldControlClassName}>
          <option value="RELATED">Pratica collegata</option>
          <option value="DUPLICATE_CANDIDATE">Possibile duplicato</option>
        </select>
      </FormField>
      <button
        type="submit"
        disabled={pending || targetReference.trim().length === 0}
        className={buttonClassName({ variant: "secondary", size: "md" })}
      >
        {pending ? "..." : "Collega pratica"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </form>
  );
}
