import { ShieldAlert } from "lucide-react";
import { WorkPanel } from "@/components/ui/WorkPanel";
import { EnforcementVerificationCard, type EnforcementCheckData } from "./EnforcementVerificationCard";
import { AppealIndicatorCard, type AppealDecisionData } from "./AppealIndicatorCard";
import type { AppealIndicatorResult } from "@/lib/appeal-indicator/calculate";
import type { CaseBlockerReason } from "@/lib/cases/blockers";

/**
 * "Analisi multa" (FASE 12, Blocco B): un unico contenitore visivo per verifica tecnica
 * documentale (`EnforcementVerificationCard`) e indicatore ricorso (`AppealIndicatorCard`) — MAI
 * un merge dei due calcoli. `deriveEnforcementOutcome` e `calculateAppealIndicator` restano
 * invariati e completamente indipendenti: questo componente compone solo la presentazione, non
 * introduce alcuna nuova logica di business né un punteggio/verdetto unico (CLAUDE.md
 * invariante 9). Gli anchor `#verifica-autovelox`/`#indicatore-ricorso` restano sui `<div>`
 * interni (spostati dentro i due componenti figli): i link esistenti da `recommended-action.ts`
 * e `QuickActions` continuano a funzionare senza modifiche.
 *
 * Il disclaimer qui sotto è un superset dei due disclaimer originali (mai più debole): copre
 * sia "solo stati documentali, mai un giudizio di validità della sanzione" (ex
 * EnforcementVerificationCard) sia "mai un parere legale né una previsione di esito" (ex
 * AppealIndicatorCard) — i due banner individuali sono stati rimossi per non duplicare lo stesso
 * concetto due volte nella stessa card.
 */
export function AnalisiMultaCard({
  caseId,
  enforcementCheck,
  attachments,
  permissions,
  blockers,
  appealResult,
  appealDecision,
  appealCostParamsSource,
  appealCostParamsVerifiedAt,
}: {
  caseId: string;
  enforcementCheck: EnforcementCheckData | null;
  attachments: { id: string; fileName: string }[];
  permissions: { canConfirm: boolean; canRequestDocuments: boolean; canLegalEscalate: boolean };
  blockers: CaseBlockerReason[];
  appealResult: AppealIndicatorResult;
  appealDecision: AppealDecisionData | null;
  appealCostParamsSource: string | null;
  appealCostParamsVerifiedAt: Date | null;
}) {
  return (
    <WorkPanel title="Analisi multa">
      <div className="flex items-start gap-2 rounded-lg bg-[var(--color-surface-muted)] p-3 text-xs text-[var(--color-ink-muted)]">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Questo pannello mostra due verifiche indipendenti — verifica tecnica documentale e indicatore ricorso — mai un&apos;unica
          valutazione. La verifica tecnica controlla solo la presenza e la coerenza della documentazione disponibile;
          l&apos;indicatore ricorso è basato su dati documentali ed economici. Nessuna delle due esprime una valutazione sulla
          validità della sanzione, un parere legale né una previsione sull&apos;esito di un eventuale ricorso. Decide sempre
          l&apos;operatore.
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <EnforcementVerificationCard caseId={caseId} check={enforcementCheck} attachments={attachments} permissions={permissions} blockers={blockers} />
        <AppealIndicatorCard
          caseId={caseId}
          result={appealResult}
          decision={appealDecision}
          appealCostParamsSource={appealCostParamsSource}
          appealCostParamsVerifiedAt={appealCostParamsVerifiedAt}
        />
      </div>
    </WorkPanel>
  );
}
