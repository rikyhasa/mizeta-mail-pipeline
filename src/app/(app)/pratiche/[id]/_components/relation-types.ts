import type { CaseRelationKind, CaseRelationStatus } from "@/generated/prisma/enums";

/** Forma condivisa tra AnomaliesCard (elenca solo i PENDING) e RelationsCard (mostra
 * anche le già decise) — normalizzata in page.tsx a partire da relationsAsSource/Target. */
export interface RelationSummary {
  id: string;
  kind: CaseRelationKind;
  status: CaseRelationStatus;
  confidence: number | null;
  reference: string;
  title: string;
}
