"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CASE_CATEGORY_LABELS } from "@/lib/i18n/labels";
import type { CaseCategory } from "@/generated/prisma/enums";

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          Nome modello
          <input value={name} onChange={(e) => setName(e.target.value)} required className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          Categoria
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">Generico (tutte le categorie)</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CASE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        Oggetto (usa {"{{campo}}"} per i dati estratti)
        <input value={subject} onChange={(e) => setSubject(e.target.value)} required className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        Corpo
        <textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} required rows={5} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <div>
        <button type="submit" disabled={pending} className="rounded border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50">
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
