import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive";
export type ButtonSize = "sm" | "md";

const BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-dark)]",
  secondary:
    "border border-[var(--color-border)] bg-white text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)]",
  tertiary: "text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]",
  destructive: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
};

/** `sm` è per azioni dense (righe di tabella); le azioni principali devono usare `md` (min. 44px). */
const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "min-h-[36px] px-3 py-1.5 text-xs",
  md: "min-h-[44px] px-4 py-2.5 text-sm",
};

export function buttonClassName({
  variant = "secondary",
  size = "md",
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return `${BASE} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`.trim();
}

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={buttonClassName({ variant, size, className })} {...props} />;
}
