function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

/** Cerchio con le iniziali dell'utente — usato nel footer della sidebar. */
export function Avatar({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d7dde2] text-xs font-semibold text-[var(--color-anthracite)] ${className}`}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
