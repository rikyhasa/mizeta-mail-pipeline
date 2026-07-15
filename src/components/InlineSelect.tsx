"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fieldControlClassName } from "@/components/ui/Field";

export function InlineSelect({
  url,
  fieldName,
  value,
  options,
  label,
}: {
  url: string;
  fieldName: string;
  value: string;
  options: { value: string; label: string }[];
  label: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [fieldName]: event.target.value || null }),
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
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor={`inline-select-${fieldName}`}>
        {label}
      </label>
      <select
        id={`inline-select-${fieldName}`}
        defaultValue={value}
        onChange={handleChange}
        disabled={pending}
        className={`${fieldControlClassName} disabled:opacity-50`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </div>
  );
}
