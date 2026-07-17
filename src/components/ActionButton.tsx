"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClassName, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";

export function ActionButton({
  id,
  method,
  url,
  body,
  children,
  confirmMessage,
  className,
  variant = "secondary",
  size = "sm",
  disabled,
  disabledReason,
}: {
  id?: string;
  method: "POST" | "PATCH";
  url: string;
  body?: unknown;
  children: React.ReactNode;
  confirmMessage?: string;
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
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
        <button
          id={id}
          type="button"
          disabled
          className={buttonClassName({ variant, size, className })}
          title={disabledReason}
        >
          {children}
        </button>
        {disabledReason && <span className="text-xs text-[var(--color-ink-muted)]">{disabledReason}</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        id={id}
        type="button"
        onClick={handleClick}
        disabled={pending}
        className={buttonClassName({ variant, size, className })}
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
