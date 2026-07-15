"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TaskForm({ caseId, users }: { caseId: string; users: { id: string; name: string }[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, assignedToId: assignedToId || null, dueAt: dueAt || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Si è verificato un errore");
        return;
      }
      setTitle("");
      setAssignedToId("");
      setDueAt("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
      <label className="flex flex-1 flex-col gap-1 text-xs text-slate-600">
        Nuova attività
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="Titolo attività"
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        Assegnata a
        <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">Non assegnata</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        Scadenza
        <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <button
        type="submit"
        disabled={pending || title.trim().length === 0}
        className="rounded border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? "..." : "Aggiungi attività"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </form>
  );
}
