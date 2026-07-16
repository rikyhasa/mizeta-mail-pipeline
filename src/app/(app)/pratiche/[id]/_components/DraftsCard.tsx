import { Sparkles } from "lucide-react";
import { WorkPanel } from "./WorkPanel";
import { Disclosure } from "@/components/ui/Disclosure";
import { ActionButton } from "@/components/ActionButton";
import { DraftCard, type DraftData } from "./DraftCard";
import { DraftHistoryRow } from "./DraftHistoryRow";

/** Solo le ultime 2 bozze precedenti restano visibili di default, il resto dietro "Mostra
 * tutte" (FASE 8B, iterazione 4) — historyDrafts arriva già più recenti prima. */
const VISIBLE_HISTORY_COUNT = 2;

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
          {historyDrafts.slice(0, VISIBLE_HISTORY_COUNT).map((d) => (
            <DraftHistoryRow key={d.id} index={draftNumberById.get(d.id) ?? 0} draft={d} />
          ))}
          {historyDrafts.length > VISIBLE_HISTORY_COUNT && (
            <Disclosure summary={`Mostra tutte (${historyDrafts.length})`}>
              <div className="flex flex-col gap-2">
                {historyDrafts.slice(VISIBLE_HISTORY_COUNT).map((d) => (
                  <DraftHistoryRow key={d.id} index={draftNumberById.get(d.id) ?? 0} draft={d} />
                ))}
              </div>
            </Disclosure>
          )}
        </div>
      )}
    </WorkPanel>
  );
}
