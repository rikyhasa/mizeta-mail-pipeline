"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormField, fieldControlClassName } from "@/components/ui/Field";
import { buttonClassName } from "@/components/ui/Button";

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
      <FormField label="Aggiungi un commento interno" htmlFor="new-comment">
        <textarea
          id="new-comment"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={2}
          className={fieldControlClassName}
        />
      </FormField>
      <div>
        <button
          type="submit"
          disabled={pending || body.trim().length === 0}
          className={buttonClassName({ variant: "secondary", size: "sm" })}
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
