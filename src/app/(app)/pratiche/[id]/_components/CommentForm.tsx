"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CommentForm({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Si è verificato un errore");
        return;
      }
      setBody("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label className="text-xs font-medium text-slate-600" htmlFor="new-comment">
        Aggiungi un commento interno
      </label>
      <textarea
        id="new-comment"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required
        rows={2}
        className="rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
      <div>
        <button
          type="submit"
          disabled={pending || body.trim().length === 0}
          className="rounded border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
        >
          {pending ? "..." : "Aggiungi commento"}
        </button>
      </div>
      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </form>
  );
}
