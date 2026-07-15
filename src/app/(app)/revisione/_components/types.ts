import type { CaseCategory, CasePriority, CaseRelationKind } from "@/generated/prisma/enums";
import type { ReviewReason } from "../_lib/review-reasons";

interface CaseRef {
  id: string;
  reference: string;
  title: string;
  category: CaseCategory;
}

export interface RelationQueueItem {
  itemType: "relation";
  id: string;
  caseId: string;
  relationKind: CaseRelationKind;
  reason: string | null;
  confidence: number | null;
  source: CaseRef;
  target: CaseRef;
}

export interface CaseQueueItem {
  itemType: "case";
  id: string;
  reference: string;
  title: string;
  category: CaseCategory;
  priority: CasePriority;
  createdAt: string | Date;
  reasons: ReviewReason[];
}

export type QueueItem = RelationQueueItem | CaseQueueItem;
