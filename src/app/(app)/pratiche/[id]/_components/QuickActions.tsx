import { FileText, ListChecks, MessageSquarePlus, Pencil } from "lucide-react";

/** Scorciatoie reali di navigazione verso le sezioni corrispondenti — non un menu di azioni
 * simulate come nella reference. Peso visivo minore di RecommendedAction (FASE 8B, problema
 * #8: nel pannello precedente tutti i pulsanti avevano lo stesso peso). */
const SHORTCUTS = [
  { href: "#dati-estratti", label: "Modifica dati", icon: Pencil },
  { href: "#attivita", label: "Aggiungi attività", icon: ListChecks },
  { href: "#commenti", label: "Commento interno", icon: MessageSquarePlus },
  { href: "#documenti", label: "Genera documento", icon: FileText },
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
