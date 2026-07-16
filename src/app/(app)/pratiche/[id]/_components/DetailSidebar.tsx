import { CheckCircle2, FileText, ListChecks, MessageSquarePlus, Pencil, RotateCcw, ShieldCheck } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { ActionButton } from "@/components/ActionButton";
import { CASE_CATEGORY_LABELS, DEPARTMENT_LABELS } from "@/lib/i18n/labels";
import type { CaseCategory, Department } from "@/generated/prisma/enums";

/** Scorciatoie reali di navigazione verso le sezioni corrispondenti — non un menu di
 * azioni simulate come nella reference ("Assegna responsabile"/"Modifica dati" aprono
 * lì un flusso finto). Stato/Responsabile sono già modificabili inline in "Sintesi
 * operativa"; qui restano solo le scorciatoie verso sezioni che richiedono più spazio. */
const SHORTCUTS = [
  { href: "#dati-estratti", label: "Modifica dati", icon: Pencil },
  { href: "#attivita", label: "Aggiungi attività", icon: ListChecks },
  { href: "#commenti", label: "Commento interno", icon: MessageSquarePlus },
  { href: "#documenti", label: "Genera documento", icon: FileText },
] as const;

export function DetailSidebar({
  caseId,
  isOpenCase,
  partyType,
  partyName,
  department,
  secondaryCategories,
}: {
  caseId: string;
  isOpenCase: boolean;
  partyType: "customer" | "supplier" | null;
  partyName: string | null;
  department: Department | null;
  secondaryCategories: CaseCategory[];
}) {
  return (
    <div className="flex flex-col gap-4 lg:sticky lg:top-24">
      <Card padding="compact">
        <CardHeader title="Azioni" />
        <div className="flex flex-col gap-2">
          {SHORTCUTS.map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              href={href}
              className="flex min-h-[44px] items-center gap-2.5 rounded-lg border border-[var(--color-border)] px-3 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]"
            >
              <Icon className="h-4 w-4 shrink-0 text-[var(--color-ink-muted)]" aria-hidden="true" />
              {label}
            </a>
          ))}
          <ActionButton
            method="PATCH"
            url={`/api/cases/${caseId}/status`}
            body={{ status: isOpenCase ? "COMPLETED" : "IN_PROGRESS" }}
            variant="primary"
            className="w-full justify-start"
          >
            {isOpenCase ? (
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            )}
            {isOpenCase ? "Segna completata" : "Riapri pratica"}
          </ActionButton>
        </div>
      </Card>

      <Card padding="compact">
        <CardHeader title="Contesto" />
        <div className="flex flex-col gap-3">
          <div>
            <span className="text-xs font-semibold tracking-wide text-[var(--color-ink-muted)] uppercase">
              {partyType === "supplier" ? "Fornitore" : "Cliente / ente"}
            </span>
            <p className="mt-1 text-sm font-medium text-[var(--color-ink)]">{partyName ?? "Non associato"}</p>
          </div>
          <div>
            <span className="text-xs font-semibold tracking-wide text-[var(--color-ink-muted)] uppercase">Reparto</span>
            <p className="mt-1 text-sm font-medium text-[var(--color-ink)]">
              {department ? DEPARTMENT_LABELS[department] : "Non assegnato"}
            </p>
          </div>
          <div>
            <span className="text-xs font-semibold tracking-wide text-[var(--color-ink-muted)] uppercase">Categorie secondarie</span>
            <p className="mt-1 text-sm font-medium text-[var(--color-ink)]">
              {secondaryCategories.length > 0 ? secondaryCategories.map((c) => CASE_CATEGORY_LABELS[c]).join(", ") : "Nessuna"}
            </p>
          </div>
        </div>
      </Card>

      <Card padding="compact" variant="flat">
        <div className="flex items-start gap-2.5 text-xs text-[var(--color-ink-muted)]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            L&apos;app non invia email, non effettua pagamenti e non scrive nel gestionale. Le bozze di risposta
            richiedono sempre approvazione umana esplicita.
          </p>
        </div>
      </Card>
    </div>
  );
}
