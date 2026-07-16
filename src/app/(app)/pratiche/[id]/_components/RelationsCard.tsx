import { ActionButton } from "@/components/ActionButton";
import { CASE_RELATION_KIND_LABELS, CASE_RELATION_STATUS_LABELS } from "@/lib/i18n/labels";
import { RelationForm } from "./RelationForm";
import type { RelationSummary } from "./relation-types";

/** Contenuto di "Collega o separa pratica": senza wrapper proprio (FASE 8B), va dentro
 * l'accordion "Relazioni e altre operazioni" in RelationsSection.tsx — mai prima di "Dati
 * estratti" (problema #4 del task doc). */
export function RelationsCard({
  caseId,
  pendingRelations,
  otherRelations,
}: {
  caseId: string;
  pendingRelations: RelationSummary[];
  otherRelations: RelationSummary[];
}) {
  return (
    <>
      {pendingRelations.length > 0 && (
        <div className="mb-3 flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-[var(--color-ink-muted)] uppercase">Candidati da verificare</h3>
          {pendingRelations.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--color-warning)_35%,white)] bg-[var(--color-warning-soft)] p-3 text-sm"
            >
              <span className="text-[var(--color-ink)]">
                {CASE_RELATION_KIND_LABELS[r.kind]}: {r.reference} — {r.title}
              </span>
              <ActionButton method="PATCH" url={`/api/cases/${caseId}/relations/${r.id}`} body={{ action: "confirm" }} size="sm">
                Unisci le pratiche
              </ActionButton>
              <ActionButton method="PATCH" url={`/api/cases/${caseId}/relations/${r.id}`} body={{ action: "reject" }} size="sm">
                Mantieni separate
              </ActionButton>
            </div>
          ))}
        </div>
      )}
      {otherRelations.length > 0 && (
        <ul className="mb-3 flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
          {otherRelations.map((r) => (
            <li key={r.id}>
              {CASE_RELATION_KIND_LABELS[r.kind]} — {r.reference} ({CASE_RELATION_STATUS_LABELS[r.status]})
            </li>
          ))}
        </ul>
      )}
      <RelationForm caseId={caseId} />
    </>
  );
}
