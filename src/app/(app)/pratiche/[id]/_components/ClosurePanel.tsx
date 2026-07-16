import { CheckCircle2, RotateCcw } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";

/** "Chiusura" (FASE 8B, problema #7): "Segna completata" non è primario e resta disabilitato
 * con il motivo visibile quando la pratica ha blocker (stessa lista di RecommendedAction) —
 * niente affidamento sull'errore dopo il clic. */
export function ClosurePanel({
  caseId,
  isOpenCase,
  blockers,
}: {
  caseId: string;
  isOpenCase: boolean;
  blockers: string[];
}) {
  const disabled = isOpenCase && blockers.length > 0;
  return (
    <div className="detail-panel">
      <h2 className="text-card-title font-semibold text-[var(--color-ink)]">Chiusura</h2>
      <div className="mt-3">
        <ActionButton
          method="PATCH"
          url={`/api/cases/${caseId}/status`}
          body={{ status: isOpenCase ? "COMPLETED" : "IN_PROGRESS" }}
          variant={!disabled && isOpenCase ? "primary" : "secondary"}
          size="md"
          disabled={disabled}
          disabledReason={disabled ? blockers.join(" · ") : undefined}
          className="w-full justify-center"
        >
          {isOpenCase ? (
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          ) : (
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          )}
          {isOpenCase ? "Segna completata" : "Riapri pratica"}
        </ActionButton>
      </div>
    </div>
  );
}
