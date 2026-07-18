import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUserOrRedirect } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/rbac";
import { CASE_STATUS_LABELS, ENFORCEMENT_DOCUMENT_TYPE_LABELS } from "@/lib/i18n/labels";
import { formatCurrency } from "@/lib/format";
import { AMOUNT_FIELD_BY_CATEGORY, parseFieldNumber } from "@/lib/dashboard/field-keys";
import { isExtractableCategory } from "@/lib/adapters/llm/schemas/extraction-index";
import { CATEGORY_FIELD_ORDER } from "@/lib/i18n/field-labels";
import type { CaseCategory, CaseStatus, GeneratedDocumentType } from "@/generated/prisma/enums";
import { DetailHeader } from "./_components/DetailHeader";
import { DetailSidebar } from "./_components/DetailSidebar";
import { SummaryCard } from "./_components/SummaryCard";
import { ExtractedFieldsSection } from "./_components/ExtractedFieldsSection";
import { EmailTimelineCard } from "./_components/EmailTimelineCard";
import { DraftsCard } from "./_components/DraftsCard";
import { DocumentsCard } from "./_components/DocumentsCard";
import { TasksCard } from "./_components/TasksCard";
import { CommentsCard } from "./_components/CommentsCard";
import { RelationsSection } from "./_components/RelationsSection";
import { AuditLogCard } from "./_components/AuditLogCard";
import { tierFields } from "./_components/field-tiers";
import { deriveRecommendedAction } from "./_components/recommended-action";
import type { RelationSummary } from "./_components/relation-types";
import { deriveCaseBlockers } from "@/lib/cases/blockers";
import { getRuleSettings } from "@/lib/rules/settings-repository";
import { resolveAppealIndicatorForCase } from "@/lib/appeal-indicator/resolve-for-case";
import { AppealIndicatorCard } from "./_components/AppealIndicatorCard";
import { EnforcementVerificationCard } from "./_components/EnforcementVerificationCard";

/** Documenti implementati in questa fase (SPEC.md §12), uno per categoria prioritaria. Le
 * altre categorie non mostrano alcun selettore: nulla è ancora implementato per loro. */
const DOCUMENT_TYPE_BY_CATEGORY: Partial<Record<CaseCategory, { type: GeneratedDocumentType; label: string }>> = {
  QUOTE_REQUEST: { type: "QUOTE_SHEET", label: "Genera scheda preventivo" },
  CLAIM_OR_DAMAGE: { type: "CLAIM_DOSSIER", label: "Genera dossier reclamo" },
  FINE_OR_PENALTY: { type: "FINE_SHEET", label: "Genera scheda multa" },
};

async function loadCase(id: string) {
  return prisma.case.findUnique({
    where: { id },
    include: {
      customer: true,
      supplier: true,
      assignedTo: { select: { id: true, name: true } },
      fields: { include: { sourceMessage: { select: { subject: true } }, confirmedBy: { select: { name: true } } } },
      deadlines: { orderBy: { dueAt: "asc" } },
      tasks: { include: { assignedTo: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      comments: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      messages: {
        include: { attachments: true, mailboxConnection: { select: { displayName: true, emailAddress: true } } },
        orderBy: { receivedAt: "asc" },
      },
      emailDrafts: { orderBy: { createdAt: "desc" } },
      generatedDocuments: { orderBy: { createdAt: "desc" } },
      auditLogs: { include: { actor: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 30 },
      relationsAsSource: { include: { relatedCase: { select: { reference: true, title: true } } } },
      relationsAsTarget: { include: { case: { select: { reference: true, title: true } } } },
      appealDecision: { include: { decidedBy: { select: { name: true } } } },
      enforcementDeviceCheck: {
        include: {
          fields: { include: { sourceMessage: { select: { subject: true } }, confirmedBy: { select: { name: true } } } },
          documentChecks: { include: { attachment: { select: { fileName: true } } } },
          registrySnapshot: { select: { fetchedAt: true, sourceUrl: true } },
          confirmedBy: { select: { name: true } },
        },
      },
    },
  });
}

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUserOrRedirect();
  const { id } = await params;

  const caseRecord = await loadCase(id);
  if (!caseRecord) notFound();

  await prisma.auditLog.create({
    data: { action: "CASE_VIEWED", entityType: "Case", entityId: caseRecord.id, caseId: caseRecord.id, actorId: user.id },
  });

  const users = await prisma.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });

  const fieldsByKey = new Map(caseRecord.fields.map((f) => [f.fieldKey, f]));
  const amountFieldKey = AMOUNT_FIELD_BY_CATEGORY[caseRecord.category];
  const amount = amountFieldKey ? parseFieldNumber(fieldsByKey.get(amountFieldKey)?.value ?? null) : null;

  const securityFlags = [...new Set(caseRecord.messages.flatMap((m) => (Array.isArray(m.securityFlags) ? (m.securityFlags as string[]) : [])))];

  const pendingRelations: RelationSummary[] = caseRecord.relationsAsSource
    .filter((r) => r.status === "PENDING")
    .map((r) => ({ id: r.id, kind: r.kind, status: r.status, confidence: r.confidence, reference: r.relatedCase.reference, title: r.relatedCase.title }));
  const otherRelations: RelationSummary[] = [
    ...caseRecord.relationsAsSource
      .filter((r) => r.status !== "PENDING")
      .map((r): RelationSummary => ({ id: r.id, kind: r.kind, status: r.status, confidence: r.confidence, reference: r.relatedCase.reference, title: r.relatedCase.title })),
    ...caseRecord.relationsAsTarget.map(
      (r): RelationSummary => ({ id: r.id, kind: r.kind, status: r.status, confidence: r.confidence, reference: r.case.reference, title: r.case.title }),
    ),
  ];

  const caseAttachments = caseRecord.messages.flatMap((m) => m.attachments.map((a) => ({ id: a.id, fileName: a.fileName })));

  const draftsChronological = [...caseRecord.emailDrafts].reverse();
  const draftNumberById = new Map(draftsChronological.map((d, i) => [d.id, i + 1]));
  const activeDraft = caseRecord.emailDrafts.find((d) => d.status === "PENDING_APPROVAL") ?? caseRecord.emailDrafts[0] ?? null;
  const historyDrafts = caseRecord.emailDrafts.filter((d) => d.id !== activeDraft?.id);

  const statusOptions = (Object.keys(CASE_STATUS_LABELS) as CaseStatus[]).map((s) => ({ value: s, label: CASE_STATUS_LABELS[s] }));
  const assigneeOptions = [{ value: "", label: "Non assegnato" }, ...users.map((u) => ({ value: u.id, label: u.name }))];
  const nextDeadline = caseRecord.deadlines.find((d) => !d.resolvedAt) ?? null;
  const otherDeadlines = caseRecord.deadlines.filter((d) => d.id !== nextDeadline?.id);
  const isOpenCase = caseRecord.status !== "COMPLETED" && caseRecord.status !== "ARCHIVED";

  const partyType: "customer" | "supplier" | null = caseRecord.customer ? "customer" : caseRecord.supplier ? "supplier" : null;
  const partyName = caseRecord.customer?.name ?? caseRecord.supplier?.name ?? null;

  const fieldOrder = isExtractableCategory(caseRecord.category) ? CATEGORY_FIELD_ORDER[caseRecord.category] : [];
  const tieredFields = tierFields(caseRecord.fields, fieldOrder);
  const problematicCount = tieredFields.filter((f) => f.tier === "problematic").length;

  const anomalyReason = fieldsByKey.get("anomaly_reason")?.value ?? null;

  // Lista unica di blocker, condivisa da RecommendedAction (sidebar) e dal pulsante "Segna
  // completata" (ClosurePanel) — e ora anche da PATCH /api/cases/[id]/status lato server
  // (docs/UX-AUDIT-2026-07.md, P0 #3): stesso calcolo in src/lib/cases/blockers.ts, non più
  // duplicato. Presentazione soltanto, nessuna nuova logica di business rispetto a prima.
  // anomaly_reason è già un campo ordinario in "Dati estratti" (vedi CATEGORY_FIELD_ORDER), qui
  // serve solo a comporre il messaggio del blocker.
  const enforcementDocumentTypeCount = Object.keys(ENFORCEMENT_DOCUMENT_TYPE_LABELS).length;
  const blockerReasons = deriveCaseBlockers({
    problematicCount,
    needsHumanReview: caseRecord.needsHumanReview,
    confidence: caseRecord.confidence,
    assignedToId: caseRecord.assignedToId,
    anomalyReason,
    securityFlagsCount: securityFlags.length,
    pendingRelationsCount: pendingRelations.length,
    enforcement: caseRecord.enforcementDeviceCheck
      ? {
          applicability: caseRecord.enforcementDeviceCheck.applicability,
          needsHumanReview: caseRecord.enforcementDeviceCheck.needsHumanReview,
          missingDocumentCount:
            enforcementDocumentTypeCount - caseRecord.enforcementDeviceCheck.documentChecks.filter((d) => d.status === "PRESENT").length,
        }
      : null,
  });

  const recommendedAction = deriveRecommendedAction({
    blockers: blockerReasons,
    activeDraftStatus: activeDraft?.status ?? null,
  });

  const firstMessage = caseRecord.messages[0] ?? null;
  const lastMessage = caseRecord.messages[caseRecord.messages.length - 1] ?? null;

  // Indicatore ricorso (docs/SPEC.md §10bis): solo per multe, calcolato a lettura — mai
  // persistito (solo l'eventuale decisione dell'operatore lo è, in AppealDecision). L'asse
  // documentale usa i segnali reali del modulo autovelox quando la pratica ne ha uno (stesso
  // enforcementDeviceCheck già caricato sopra per EnforcementVerificationCard, nessuna query
  // aggiuntiva) — fallback generico solo per multe non-velox (enforcementDeviceCheck null).
  const appealIndicatorResult =
    caseRecord.category === "FINE_OR_PENALTY"
      ? resolveAppealIndicatorForCase(
          caseRecord.fields,
          caseRecord.enforcementDeviceCheck
            ? {
                applicability: caseRecord.enforcementDeviceCheck.applicability,
                registryMatch: caseRecord.enforcementDeviceCheck.registryMatch,
                documentChecks: caseRecord.enforcementDeviceCheck.documentChecks,
              }
            : null,
          await getRuleSettings(),
          new Date(),
        )
      : null;

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        reference={caseRecord.reference}
        category={caseRecord.category}
        title={caseRecord.title}
        isPec={caseRecord.isPec}
        documentTypeLabel={DOCUMENT_TYPE_BY_CATEGORY[caseRecord.category]?.label}
      />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <SummaryCard
            caseId={caseRecord.id}
            priority={caseRecord.priority}
            summary={caseRecord.summary}
            confidence={caseRecord.confidence}
            status={caseRecord.status}
            statusOptions={statusOptions}
            assignedToId={caseRecord.assignedToId}
            assigneeOptions={assigneeOptions}
            nextDeadlineAt={nextDeadline?.dueAt ?? null}
            otherDeadlines={otherDeadlines}
            amountFormatted={formatCurrency(amount)}
          />

          {caseRecord.category === "FINE_OR_PENALTY" && (
            <EnforcementVerificationCard
              caseId={caseRecord.id}
              check={
                caseRecord.enforcementDeviceCheck
                  ? {
                      applicability: caseRecord.enforcementDeviceCheck.applicability,
                      state: caseRecord.enforcementDeviceCheck.state,
                      needsHumanReview: caseRecord.enforcementDeviceCheck.needsHumanReview,
                      needsLegalReview: caseRecord.enforcementDeviceCheck.needsLegalReview,
                      registryMatch: caseRecord.enforcementDeviceCheck.registryMatch,
                      registrySnapshot: caseRecord.enforcementDeviceCheck.registrySnapshot,
                      confirmedByName: caseRecord.enforcementDeviceCheck.confirmedBy?.name ?? null,
                      fields: caseRecord.enforcementDeviceCheck.fields,
                      documentChecks: caseRecord.enforcementDeviceCheck.documentChecks.map((d) => ({
                        documentType: d.documentType,
                        status: d.status,
                        note: d.note,
                        attachmentId: d.attachmentId,
                        attachmentFileName: d.attachment?.fileName ?? null,
                      })),
                    }
                  : null
              }
              attachments={caseAttachments}
              permissions={{
                canConfirm: hasPermission(user.role, "enforcement:confirm"),
                canRequestDocuments: hasPermission(user.role, "enforcement:request-documents"),
                canLegalEscalate: hasPermission(user.role, "enforcement:legal-escalate"),
              }}
              blockers={blockerReasons}
            />
          )}

          {appealIndicatorResult && (
            <AppealIndicatorCard
              caseId={caseRecord.id}
              result={appealIndicatorResult}
              decision={
                caseRecord.appealDecision
                  ? {
                      decision: caseRecord.appealDecision.decision,
                      note: caseRecord.appealDecision.note,
                      decidedByName: caseRecord.appealDecision.decidedBy?.name ?? null,
                      decidedAt: caseRecord.appealDecision.decidedAt,
                    }
                  : null
              }
            />
          )}

          <ExtractedFieldsSection
            caseId={caseRecord.id}
            category={caseRecord.category}
            totalFieldCount={caseRecord.fields.length}
            problematicCount={problematicCount}
            fields={tieredFields}
          />

          <EmailTimelineCard messages={caseRecord.messages} />

          <DraftsCard
            caseId={caseRecord.id}
            activeDraft={activeDraft}
            historyDrafts={historyDrafts}
            draftNumberById={draftNumberById}
          />

          <TasksCard caseId={caseRecord.id} tasks={caseRecord.tasks} users={users} />

          <CommentsCard caseId={caseRecord.id} comments={caseRecord.comments} />

          <DocumentsCard
            caseId={caseRecord.id}
            documents={caseRecord.generatedDocuments}
            documentType={DOCUMENT_TYPE_BY_CATEGORY[caseRecord.category]}
          />

          <RelationsSection caseId={caseRecord.id} pendingRelations={pendingRelations} otherRelations={otherRelations} />

          <AuditLogCard logs={caseRecord.auditLogs} />
        </div>

        <DetailSidebar
          caseId={caseRecord.id}
          isOpenCase={isOpenCase}
          blockers={blockerReasons.map((b) => b.text)}
          recommendedAction={recommendedAction}
          documentCount={caseRecord.generatedDocuments.length}
          lastDocumentAt={caseRecord.generatedDocuments[0]?.createdAt ?? null}
          partyType={partyType}
          partyName={partyName}
          fromName={lastMessage?.fromName ?? null}
          fromAddress={lastMessage?.fromAddress ?? null}
          mailboxDisplayName={lastMessage?.mailboxConnection.displayName ?? null}
          mailboxAddress={lastMessage?.mailboxConnection.emailAddress ?? null}
          department={caseRecord.department}
          receivedAt={firstMessage?.receivedAt ?? null}
          updatedAt={caseRecord.updatedAt}
          vehicleType={fieldsByKey.get("vehicle_type")?.value ?? null}
          plate={fieldsByKey.get("plate")?.value ?? null}
          driverName={fieldsByKey.get("driver_name")?.value ?? null}
          secondaryCategories={caseRecord.secondaryCategories}
          needsHumanReview={caseRecord.needsHumanReview}
        />
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
