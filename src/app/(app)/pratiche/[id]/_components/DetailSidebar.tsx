import { RecommendedAction } from "./RecommendedAction";
import { QuickActions } from "./QuickActions";
import { DocumentsPanel } from "./DocumentsPanel";
import { ClosurePanel } from "./ClosurePanel";
import { ContextPanel } from "./ContextPanel";
import type { RecommendedActionData } from "./recommended-action";
import type { CaseCategory, Department } from "@/generated/prisma/enums";

/** Composizione sottile dei 5 gruppi del pannello laterale (FASE 8B): Prossima azione,
 * Azioni rapide, Documenti, Chiusura, Contesto — sostituisce i 3 gruppi indifferenziati
 * precedenti (problema #8 del task doc). */
export function DetailSidebar({
  caseId,
  isOpenCase,
  blockers,
  recommendedAction,
  documentCount,
  lastDocumentAt,
  partyType,
  partyName,
  fromName,
  fromAddress,
  mailboxDisplayName,
  mailboxAddress,
  department,
  receivedAt,
  updatedAt,
  vehicleType,
  plate,
  driverName,
  secondaryCategories,
  needsHumanReview,
}: {
  caseId: string;
  isOpenCase: boolean;
  blockers: string[];
  recommendedAction: RecommendedActionData | null;
  documentCount: number;
  lastDocumentAt: Date | null;
  partyType: "customer" | "supplier" | null;
  partyName: string | null;
  fromName: string | null;
  fromAddress: string | null;
  mailboxDisplayName: string | null;
  mailboxAddress: string | null;
  department: Department | null;
  receivedAt: Date | null;
  updatedAt: Date;
  vehicleType: string | null;
  plate: string | null;
  driverName: string | null;
  secondaryCategories: CaseCategory[];
  needsHumanReview: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 print:hidden lg:sticky lg:top-24">
      <RecommendedAction action={recommendedAction} />
      <QuickActions />
      <DocumentsPanel documentCount={documentCount} lastDocumentAt={lastDocumentAt} />
      <ClosurePanel caseId={caseId} isOpenCase={isOpenCase} blockers={blockers} />
      <ContextPanel
        partyType={partyType}
        partyName={partyName}
        fromName={fromName}
        fromAddress={fromAddress}
        mailboxDisplayName={mailboxDisplayName}
        mailboxAddress={mailboxAddress}
        department={department}
        receivedAt={receivedAt}
        updatedAt={updatedAt}
        vehicleType={vehicleType}
        plate={plate}
        driverName={driverName}
        secondaryCategories={secondaryCategories}
        needsHumanReview={needsHumanReview}
      />
    </div>
  );
}
