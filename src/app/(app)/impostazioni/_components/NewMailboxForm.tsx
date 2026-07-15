"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Collega una mailbox reale per il provider attivo (env.EMAIL_PROVIDER) — vedi
 * `/api/settings/mailboxes` per la logica di connessione. */
export function NewMailboxForm({ emailProviderLabel }: { emailProviderLabel: string }) {
  const router = useRouter();
  const [emailAddress, setEmailAddress] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/mailboxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailAddress, displayName }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Si è verificato un errore");
        return;
      }
      setEmailAddress("");
      setDisplayName("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        Nome visualizzato
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        Indirizzo email
        <input
          type="email"
          value={emailAddress}
          onChange={(e) => setEmailAddress(e.target.value)}
          required
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? "..." : `Collega mailbox (${emailProviderLabel})`}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </form>
  );
}
