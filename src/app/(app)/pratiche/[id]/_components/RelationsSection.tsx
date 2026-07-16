import { Disclosure } from "@/components/ui/Disclosure";
import { Badge } from "@/components/ui/Badge";
import { RelationsCard } from "./RelationsCard";
import type { RelationSummary } from "./relation-types";

/** "Relazioni e altre operazioni" (FASE 8B, composizione vincolante #9): accordion chiuso di
 * default, aperto solo se ci sono relazioni pendenti da verificare. Posizionato dopo
 * "Documenti generati" e prima di "Registro attività" — mai prima di "Dati estratti" (problema
 * #4). Primo utilizzo reale di Disclosure.tsx (fin qui codice morto, zero call site). */
export function RelationsSection({
  caseId,
  pendingRelations,
  otherRelations,
}: {
  caseId: string;
  pendingRelations: RelationSummary[];
  otherRelations: RelationSummary[];
}) {
  const total = pendingRelations.length + otherRelations.length;
  return (
    <div id="relazioni" className="detail-panel scroll-mt-24">
      <Disclosure
        defaultOpen={pendingRelations.length > 0}
        summary={
          <span className="flex items-center gap-2 text-card-title font-semibold text-[var(--color-ink)]">
            Relazioni e altre operazioni
            {total > 0 && <Badge tone={pendingRelations.length > 0 ? "warning" : "neutral"}>{total}</Badge>}
          </span>
        }
      >
        <RelationsCard caseId={caseId} pendingRelations={pendingRelations} otherRelations={otherRelations} />
      </Disclosure>
    </div>
  );
}
