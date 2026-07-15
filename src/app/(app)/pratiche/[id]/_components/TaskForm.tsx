"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormField, fieldControlClassName } from "@/components/ui/Field";
import { buttonClassName } from "@/components/ui/Button";

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <FormField label="Nuova attività" htmlFor="new-task-title">
          <input
            id="new-task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Titolo attività"
            className={fieldControlClassName}
          />
        </FormField>
      </div>
      <FormField label="Assegnata a" htmlFor="new-task-assignee">
        <select id="new-task-assignee" value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} className={fieldControlClassName}>
          <option value="">Non assegnata</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Scadenza" htmlFor="new-task-due">
        <input id="new-task-due" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={fieldControlClassName} />
      </FormField>
      <button
        type="submit"
        disabled={pending || title.trim().length === 0}
        className={buttonClassName({ variant: "secondary", size: "md" })}
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
