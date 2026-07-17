import { FileText, ListChecks, MessageSquarePlus, Pencil } from "lucide-react";

/**
 * "Aggiungi attività"/"Commento interno"/"Genera documento" puntano direttamente al primo
 * campo focalizzabile dentro la sezione (`#new-task-title`, `#new-comment`,
 * `#documenti-azione`), non al contenitore: sono quindi azioni reali, non solo scorrimento
 * (docs/UX-AUDIT-2026-07.md, punto 3.3.5). Per i primi due basta il comportamento nativo del
 * browser (la navigazione a un fragment dentro un `<details>` chiuso lo apre e sposta il focus
 * sul target, senza JavaScript); "Genera documento" punta a un bottone già visibile, che il
 * browser scorre in vista ma non focalizza da solo — completato da `FocusOnHashMatch` in
 * `DocumentsCard.tsx`. "Vai ai dati" resta puro scorrimento verso la sezione: nessun singolo
 * campo è "il" campo da correggere, la scelta spetta all'operatore. */
const SHORTCUTS = [
  { href: "#dati-estratti", label: "Vai ai dati", icon: Pencil },
  { href: "#new-task-title", label: "Aggiungi attività", icon: ListChecks },
  { href: "#new-comment", label: "Commento interno", icon: MessageSquarePlus },
  { href: "#documenti-azione", label: "Genera documento", icon: FileText },
] as const;

export function QuickActions() {
  return (
    <div className="detail-panel">
      <h2 className="text-card-title font-semibold text-[var(--color-ink)]">Azioni rapide</h2>
      <div className="mt-3 flex flex-col gap-0.5">
        {SHORTCUTS.map(({ href, label, icon: Icon }) => (
          <a key={href} href={href} className="detail-quick-link">
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {label}
          </a>
        ))}
      </div>
    </div>
  );
}
