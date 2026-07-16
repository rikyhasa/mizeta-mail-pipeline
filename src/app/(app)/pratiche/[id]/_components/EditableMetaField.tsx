"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { InlineSelect } from "@/components/InlineSelect";

/** Stato/Responsabile in "Sintesi operativa" (FASE 8B, problema #11): la reference li mostra
 * come etichetta maiuscola + valore in grassetto (statici); qui restano modificabili — al
 * click rivelano l'InlineSelect esistente, invariato. Il refresh dopo un salvataggio riuscito
 * (router.refresh() dentro InlineSelect) rimonta l'albero coi props aggiornati e riporta
 * automaticamente questo componente in modalità sola lettura. */
export function EditableMetaField({
  label,
  url,
  fieldName,
  value,
  options,
}: {
  label: string;
  url: string;
  fieldName: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const current = options.find((o) => o.value === value)?.label ?? "—";

  if (editing) {
    return <InlineSelect url={url} fieldName={fieldName} value={value} options={options} label={label} />;
  }

  return (
    <div>
      <span className="detail-label">{label}</span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`Modifica ${label.toLowerCase()}: attuale ${current}`}
        className="mt-1 flex min-h-[24px] items-center gap-1.5 rounded text-left text-[13px] font-bold text-[var(--color-ink)] hover:text-[var(--color-brand-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]"
      >
        {current}
        <Pencil className="h-3 w-3 shrink-0 text-[var(--color-ink-muted)]" aria-hidden="true" />
      </button>
    </div>
  );
}
