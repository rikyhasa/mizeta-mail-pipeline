import { CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { requireUserOrRedirect } from "@/lib/auth/guard";
import { getRuleSettings } from "@/lib/rules/settings-repository";
import { EmptyState } from "@/components/ui/EmptyState";
import { computeReasons } from "./_lib/review-reasons";
import { ReviewQueueSplitView } from "./_components/ReviewQueueSplitView";
import type { QueueItem } from "./_components/types";

export default async function ReviewQueuePage() {
  await requireUserOrRedirect();
  const settings = await getRuleSettings();

  const pendingRelations = await prisma.caseRelation.findMany({
    where: { status: "PENDING" },
    include: {
      case: { select: { id: true, reference: true, title: true, category: true } },
      relatedCase: { select: { id: true, reference: true, title: true, category: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const coveredCaseIds = pendingRelations.map((r) => r.caseId);
  const casesToVerify = await prisma.case.findMany({
    where: { needsHumanReview: true, id: { notIn: coveredCaseIds } },
    select: {
      id: true,
      reference: true,
      title: true,
      category: true,
      priority: true,
      confidence: true,
      createdAt: true,
      fields: { select: { fieldKey: true, value: true, needsHumanReview: true } },
      deadlines: { where: { isCritical: true, resolvedAt: null }, select: { dueAt: true }, take: 1 },
      messages: { select: { securityFlags: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const items: QueueItem[] = [
    ...pendingRelations.map(
      (r): QueueItem => ({
        itemType: "relation",
        id: r.id,
        caseId: r.caseId,
        relationKind: r.kind,
        reason: r.reason,
        confidence: r.confidence,
        source: r.case,
        target: r.relatedCase,
      }),
    ),
    ...casesToVerify.map(
      (c): QueueItem => ({
        itemType: "case",
        id: c.id,
        reference: c.reference,
        title: c.title,
        category: c.category,
        priority: c.priority,
        createdAt: c.createdAt,
        reasons: computeReasons(c, settings.classificationConfidenceThreshold),
      }),
    ),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-page-title font-semibold text-[var(--color-ink)]">Coda di revisione</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Possibili duplicati, pratiche correlate e pratiche che richiedono un controllo umano.
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Non ci sono elementi da verificare" description="Tutto sotto controllo." />
      ) : (
        <ReviewQueueSplitView items={items} />
      )}
    </div>
  );
}

export const dynamic = "force-dynamic";
