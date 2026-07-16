import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUserOrRedirect } from "@/lib/auth/guard";
import { CASE_STATUS_LABELS } from "@/lib/i18n/labels";
import { formatCurrency } from "@/lib/format";
import { AMOUNT_FIELD_BY_CATEGORY, parseFieldNumber } from "@/lib/dashboard/field-keys";
import type { CaseCategory, CaseStatus, GeneratedDocumentType } from "@/generated/prisma/enums";
import { DetailHeader } from "./_components/DetailHeader";
import { DetailSidebar } from "./_components/DetailSidebar";
import { SummaryCard } from "./_components/SummaryCard";
import { DeadlinesCard } from "./_components/DeadlinesCard";
import { AnomaliesCard } from "./_components/AnomaliesCard";
import { RelationsCard } from "./_components/RelationsCard";
import { ExtractedFieldsSection } from "./_components/ExtractedFieldsSection";
import { EmailTimelineCard } from "./_components/EmailTimelineCard";
import { DraftsCard } from "./_components/DraftsCard";
import { DocumentsCard } from "./_components/DocumentsCard";
import { TasksCard } from "./_components/TasksCard";
import { CommentsCard } from "./_components/CommentsCard";
import { AuditLogCard } from "./_components/AuditLogCard";
import type { RelationSummary } from "./_components/relation-types";

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
      messages: { include: { attachments: true }, orderBy: { receivedAt: "asc" } },
      emailDrafts: { orderBy: { createdAt: "desc" } },
      generatedDocuments: { orderBy: { createdAt: "desc" } },
      auditLogs: { include: { actor: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 30 },
      relationsAsSource: { include: { relatedCase: { select: { reference: true, title: true } } } },
      relationsAsTarget: { include: { case: { select: { reference: true, title: true } } } },
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

  const draftsChronological = [...caseRecord.emailDrafts].reverse();
  const draftNumberById = new Map(draftsChronological.map((d, i) => [d.id, i + 1]));
  const activeDraft = caseRecord.emailDrafts.find((d) => d.status === "PENDING_APPROVAL") ?? caseRecord.emailDrafts[0] ?? null;
  const historyDrafts = caseRecord.emailDrafts.filter((d) => d.id !== activeDraft?.id);

  const statusOptions = (Object.keys(CASE_STATUS_LABELS) as CaseStatus[]).map((s) => ({ value: s, label: CASE_STATUS_LABELS[s] }));
  const assigneeOptions = [{ value: "", label: "Non assegnato" }, ...users.map((u) => ({ value: u.id, label: u.name }))];
  const nextDeadline = caseRecord.deadlines.find((d) => !d.resolvedAt) ?? null;
  const isOpenCase = caseRecord.status !== "COMPLETED" && caseRecord.status !== "ARCHIVED";

  const partyType: "customer" | "supplier" | null = caseRecord.customer ? "customer" : caseRecord.supplier ? "supplier" : null;
  const partyName = caseRecord.customer?.name ?? caseRecord.supplier?.name ?? null;

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader reference={caseRecord.reference} category={caseRecord.category} title={caseRecord.title} isPec={caseRecord.isPec} />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
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
            amountFormatted={formatCurrency(amount)}
          />

          <DeadlinesCard deadlines={caseRecord.deadlines} />

          <AnomaliesCard
            anomalyReason={fieldsByKey.get("anomaly_reason")?.value ?? null}
            securityFlags={securityFlags}
            pendingRelations={pendingRelations}
          />

          <RelationsCard caseId={caseRecord.id} pendingRelations={pendingRelations} otherRelations={otherRelations} />

          <ExtractedFieldsSection caseId={caseRecord.id} category={caseRecord.category} fields={caseRecord.fields} />

          <EmailTimelineCard messages={caseRecord.messages} />

          <DraftsCard
            caseId={caseRecord.id}
            activeDraft={activeDraft}
            historyDrafts={historyDrafts}
            draftNumberById={draftNumberById}
          />

          <DocumentsCard
            caseId={caseRecord.id}
            documents={caseRecord.generatedDocuments}
            documentType={DOCUMENT_TYPE_BY_CATEGORY[caseRecord.category]}
          />

          <TasksCard caseId={caseRecord.id} tasks={caseRecord.tasks} users={users} />

          <CommentsCard caseId={caseRecord.id} comments={caseRecord.comments} />

          <AuditLogCard logs={caseRecord.auditLogs} />
        </div>

        <DetailSidebar
          caseId={caseRecord.id}
          isOpenCase={isOpenCase}
          partyType={partyType}
          partyName={partyName}
          department={caseRecord.department}
          secondaryCategories={caseRecord.secondaryCategories}
        />
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
