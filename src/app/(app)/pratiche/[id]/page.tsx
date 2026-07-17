import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUserOrRedirect } from "@/lib/auth/guard";
import { CASE_STATUS_LABELS } from "@/lib/i18n/labels";
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

/** Documenti implementati in questa fase (SPEC.md §12), uno per categoria prioritaria. Le
 * altre categorie non mostrano alcun selettore: nulla è ancora implementato per loro. */
const DOCUMENT_TYPE_BY_CATEGORY: Partial<Record<CaseCategory, { type: GeneratedDocumentType; label: string }>> = {
  QUOTE_REQUEST: { type: "QUOTE_SHEET", label: "Genera scheda preventivo" },
  CLAIM_OR_DAMAGE: { type: "CLAIM_DOSSIER", label: "Genera dossier reclamo" },
  FINE_OR_PENALTY: { type: "FINE_SHEET", label: "Genera scheda multa" },
};

/** Soglia di confidenza bassa: stesso valore già usato in ExtractedFieldCell.tsx (70%), non un
 * nuovo numero inventato per FASE 8B. */
const LOW_CONFIDENCE_THRESHOLD = 0.7;

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
  const otherDeadlines = caseRecord.deadlines.filter((d) => d.id !== nextDeadline?.id);
  const isOpenCase = caseRecord.status !== "COMPLETED" && caseRecord.status !== "ARCHIVED";

  const partyType: "customer" | "supplier" | null = caseRecord.customer ? "customer" : caseRecord.supplier ? "supplier" : null;
  const partyName = caseRecord.customer?.name ?? caseRecord.supplier?.name ?? null;

  const fieldOrder = isExtractableCategory(caseRecord.category) ? CATEGORY_FIELD_ORDER[caseRecord.category] : [];
  const tieredFields = tierFields(caseRecord.fields, fieldOrder);
  const problematicCount = tieredFields.filter((f) => f.tier === "problematic").length;

  const anomalyReason = fieldsByKey.get("anomaly_reason")?.value ?? null;

  // Lista unica di blocker, condivisa da RecommendedAction (sidebar) e dal pulsante "Segna
  // completata" (ClosurePanel) — presentazione soltanto, nessuna nuova logica di business.
  // È anche l'unico posto dove questi segnali compaiono nella colonna principale: niente più
  // blocco "Attenzione richiesta" separato che ripeteva la stessa informazione (FASE 8B,
  // iterazione 3) — anomaly_reason è già un campo ordinario in "Dati estratti" (vedi
  // CATEGORY_FIELD_ORDER), qui serve solo a comporre il messaggio del blocker.
  const blockerReasons: { text: string; href: string }[] = [];
  if (problematicCount > 0) {
    blockerReasons.push({
      text: `${problematicCount} dato/i mancante/i o da verificare`,
      href: "#dati-estratti",
    });
  }
  if (caseRecord.needsHumanReview) {
    blockerReasons.push({ text: "La pratica richiede revisione umana", href: "#dati-estratti" });
  }
  if (caseRecord.confidence !== null && caseRecord.confidence < LOW_CONFIDENCE_THRESHOLD) {
    blockerReasons.push({
      text: `Confidenza classificazione bassa (${Math.round(caseRecord.confidence * 100)}%)`,
      href: "#sintesi",
    });
  }
  if (!caseRecord.assignedToId) {
    blockerReasons.push({ text: "Nessun responsabile assegnato", href: "#sintesi" });
  }
  if (anomalyReason) {
    blockerReasons.push({ text: `Anomalia fattura: ${anomalyReason}`, href: "#dati-estratti" });
  }
  if (securityFlags.length > 0) {
    blockerReasons.push({ text: `${securityFlags.length} segnale/i di sicurezza rilevato/i nelle email`, href: "#email" });
  }
  if (pendingRelations.length > 0) {
    blockerReasons.push({ text: `${pendingRelations.length} collegamento/i pratica da verificare`, href: "#relazioni" });
  }

  const recommendedAction = deriveRecommendedAction({
    blockers: blockerReasons.map((b) => b.text),
    blockerHrefs: blockerReasons.map((b) => b.href),
    activeDraftStatus: activeDraft?.status ?? null,
  });

  const firstMessage = caseRecord.messages[0] ?? null;
  const lastMessage = caseRecord.messages[caseRecord.messages.length - 1] ?? null;

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
