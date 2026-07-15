"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CASE_CATEGORY_LABELS } from "@/lib/i18n/labels";
import type { CaseCategory } from "@/generated/prisma/enums";
import { FormField, fieldControlClassName } from "@/components/ui/Field";
import { buttonClassName } from "@/components/ui/Button";

const CATEGORIES = Object.keys(CASE_CATEGORY_LABELS) as CaseCategory[];

export function NewReplyTemplateForm() {
  const router = useRouter();
  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/reply-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: category || null, name, subject, bodyText }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Si è verificato un errore");
        return;
      }
      setName("");
      setSubject("");
      setBodyText("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-4">
      <div className="flex flex-wrap gap-3">
        <FormField label="Nome modello" htmlFor="new-template-name">
          <input id="new-template-name" value={name} onChange={(e) => setName(e.target.value)} required className={fieldControlClassName} />
        </FormField>
        <FormField label="Categoria" htmlFor="new-template-category">
          <select id="new-template-category" value={category} onChange={(e) => setCategory(e.target.value)} className={fieldControlClassName}>
            <option value="">Generico (tutte le categorie)</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CASE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <FormField label="Oggetto (usa {{campo}} per i dati estratti)" htmlFor="new-template-subject">
        <input id="new-template-subject" value={subject} onChange={(e) => setSubject(e.target.value)} required className={fieldControlClassName} />
      </FormField>
      <FormField label="Corpo" htmlFor="new-template-body">
        <textarea
          id="new-template-body"
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          required
          rows={5}
          className={fieldControlClassName}
        />
      </FormField>
      <div>
        <button type="submit" disabled={pending} className={buttonClassName({ variant: "secondary", size: "md" })}>
          {pending ? "..." : "Crea modello"}
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
