"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClassName } from "@/components/ui/Button";
import { fieldControlClassName } from "@/components/ui/Field";
import type { EnforcementDocumentType } from "@/generated/prisma/enums";

/** "Collega documento" (docs/SPEC-AUTOVELOX-DRAFT.md §8): sceglie fra gli allegati già presenti
 * nella pratica — mai un upload diretto qui (CLAUDE.md invariante 2, gli allegati arrivano solo
 * dalle email). */
export function EnforcementDocumentLinkForm({
  caseId,
  documentType,
  attachments,
}: {
  caseId: string;
  documentType: EnforcementDocumentType;
  attachments: { id: string; fileName: string }[];
}) {
  const router = useRouter();
  const [attachmentId, setAttachmentId] = useState(attachments[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (attachments.length === 0) {
    return <p className="text-xs text-[var(--color-ink-muted)]">Nessun allegato disponibile in questa pratica da collegare.</p>;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/enforcement/documents/${documentType}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachmentId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Si è verificato un errore");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`doc-link-${documentType}`}>
        Allegato da collegare
      </label>
      <select
        id={`doc-link-${documentType}`}
        value={attachmentId}
        onChange={(e) => setAttachmentId(e.target.value)}
        className={fieldControlClassName}
      >
        {attachments.map((a) => (
          <option key={a.id} value={a.id}>
            {a.fileName}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending} className={buttonClassName({ variant: "secondary", size: "sm" })}>
        {pending ? "..." : "Collega documento"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </form>
  );
}
