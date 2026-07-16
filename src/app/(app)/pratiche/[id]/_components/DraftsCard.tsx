import { Sparkles } from "lucide-react";
import { WorkPanel } from "./WorkPanel";
import { ActionButton } from "@/components/ActionButton";
import { DraftCard, type DraftData } from "./DraftCard";
import { DraftHistoryRow } from "./DraftHistoryRow";

/** "Bozza di risposta": a differenza della reference (bottone "Crea/Rigenera bozza"
 * puramente simulato), qui chiama davvero POST /api/cases/:id/drafts, che genera la
 * bozza tramite LLMProvider reale e resta comunque soggetta ad approvazione umana. */
export function DraftsCard({
  caseId,
  activeDraft,
  historyDrafts,
  draftNumberById,
}: {
  caseId: string;
  activeDraft: DraftData | null;
  historyDrafts: DraftData[];
  draftNumberById: Map<string, number>;
}) {
  return (
    <WorkPanel
      id="bozza"
      title="Bozza di risposta"
      description="Le bozze non vengono mai inviate: richiedono sempre approvazione umana esplicita."
    >
      {!activeDraft && <p className="mb-3 text-sm text-[var(--color-ink-muted)]">Nessuna bozza generata.</p>}
      {activeDraft && <DraftCard caseId={caseId} draft={activeDraft} />}
      <ActionButton method="POST" url={`/api/cases/${caseId}/drafts`} className="mt-3">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        {activeDraft ? "Rigenera bozza" : "Crea bozza"}
      </ActionButton>
      {historyDrafts.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-[var(--color-ink-muted)] uppercase">Bozze precedenti</h3>
          {historyDrafts.map((d) => (
            <DraftHistoryRow key={d.id} index={draftNumberById.get(d.id) ?? 0} draft={d} />
          ))}
        </div>
      )}
    </WorkPanel>
  );
}
