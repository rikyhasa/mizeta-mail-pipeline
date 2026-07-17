"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClassName } from "@/components/ui/Button";
import { fieldControlClassName } from "@/components/ui/Field";
import type { AppealDecisionKind } from "@/generated/prisma/enums";

const DECISION_OPTIONS: { value: AppealDecisionKind; label: string }[] = [
  { value: "GDP_FILED", label: "Ricorso GdP avviato" },
  { value: "PREFETTO_FILED", label: "Ricorso Prefetto avviato" },
  { value: "NO_APPEAL", label: "Nessun ricorso" },
];

/** Registra la decisione dell'operatore (docs/SPEC.md §10bis) — azione reale, chiama
 * PATCH /api/cases/[id]/appeal-decision. Il calcolo dell'indicatore non cambia: solo la
 * decisione viene salvata, con audit. */
export function AppealDecisionForm({ caseId, initialNote }: { caseId: string; initialNote: string | null }) {
  const router = useRouter();
  const [note, setNote] = useState(initialNote ?? "");
  const [pending, setPending] = useState<AppealDecisionKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function record(decision: AppealDecisionKind) {
    setPending(decision);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/appeal-decision`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: note.trim() || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Si è verificato un errore");
        return;
      }
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-ink)]">
        Nota (facoltativa)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className={fieldControlClassName}
          placeholder="Es. concordato con il cliente, in attesa di documenti dall'ente..."
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {DECISION_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => record(opt.value)}
            disabled={pending !== null}
            className={buttonClassName({ variant: "secondary", size: "sm" })}
          >
            {pending === opt.value ? "..." : opt.label}
          </button>
        ))}
      </div>
      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </div>
  );
}
