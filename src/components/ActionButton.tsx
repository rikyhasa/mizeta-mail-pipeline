"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ActionButton({
  method,
  url,
  body,
  children,
  confirmMessage,
  className,
  disabled,
  disabledReason,
}: {
  method: "POST" | "PATCH";
  url: string;
  body?: unknown;
  children: React.ReactNode;
  confirmMessage?: string;
  className?: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body !== undefined ? JSON.stringify(body) : undefined,
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

  if (disabled) {
    return (
      <span className="inline-flex flex-col gap-1">
        <button type="button" disabled className={className ?? "cursor-not-allowed rounded border border-slate-200 px-2 py-1 text-xs text-slate-400"} title={disabledReason}>
          {children}
        </button>
        {disabledReason && <span className="text-xs text-slate-400">{disabledReason}</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className={className ?? "rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"}
      >
        {pending ? "..." : children}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </span>
  );
}
