"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        Riferimento pratica da collegare
        <input
          value={targetReference}
          onChange={(e) => setTargetReference(e.target.value)}
          required
          placeholder="es. PRT-2026-0009"
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        Tipo
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="rounded border border-slate-300 px-2 py-1.5 text-sm">
          <option value="RELATED">Pratica collegata</option>
          <option value="DUPLICATE_CANDIDATE">Possibile duplicato</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={pending || targetReference.trim().length === 0}
        className="rounded border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
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
