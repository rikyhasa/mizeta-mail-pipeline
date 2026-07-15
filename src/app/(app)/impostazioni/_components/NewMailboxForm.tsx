"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormField, fieldControlClassName } from "@/components/ui/Field";
import { buttonClassName } from "@/components/ui/Button";

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
    <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-end gap-3 border-t border-[var(--color-border)] pt-4">
      <FormField label="Nome visualizzato" htmlFor="new-mailbox-name">
        <input
          id="new-mailbox-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          className={fieldControlClassName}
        />
      </FormField>
      <FormField label="Indirizzo email" htmlFor="new-mailbox-email">
        <input
          id="new-mailbox-email"
          type="email"
          value={emailAddress}
          onChange={(e) => setEmailAddress(e.target.value)}
          required
          className={fieldControlClassName}
        />
      </FormField>
      <button type="submit" disabled={pending} className={buttonClassName({ variant: "secondary", size: "md" })}>
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
