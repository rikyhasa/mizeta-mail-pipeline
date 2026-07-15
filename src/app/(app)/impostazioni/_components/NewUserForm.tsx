"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_LABELS } from "@/lib/i18n/labels";
import type { Role } from "@/generated/prisma/enums";
import { FormField, fieldControlClassName } from "@/components/ui/Field";
import { buttonClassName } from "@/components/ui/Button";

const ROLES = Object.keys(ROLE_LABELS) as Role[];

export function NewUserForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("OPERATIONS");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, role, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Si è verificato un errore");
        return;
      }
      setEmail("");
      setName("");
      setPassword("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 border-t border-[var(--color-border)] pt-4">
      <FormField label="Nome" htmlFor="new-user-name">
        <input id="new-user-name" value={name} onChange={(e) => setName(e.target.value)} required className={fieldControlClassName} />
      </FormField>
      <FormField label="Email" htmlFor="new-user-email">
        <input
          id="new-user-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={fieldControlClassName}
        />
      </FormField>
      <FormField label="Ruolo" htmlFor="new-user-role">
        <select id="new-user-role" value={role} onChange={(e) => setRole(e.target.value as Role)} className={fieldControlClassName}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Password iniziale" htmlFor="new-user-password">
        <input
          id="new-user-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className={fieldControlClassName}
        />
      </FormField>
      <button type="submit" disabled={pending} className={buttonClassName({ variant: "secondary", size: "md" })}>
        {pending ? "..." : "Crea utente"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </form>
  );
}
