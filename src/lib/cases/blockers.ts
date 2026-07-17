import { prisma } from "@/lib/db/prisma";
import { classifyFieldTier } from "@/app/(app)/pratiche/[id]/_components/field-tiers";

/** Stesso valore già usato in ExtractedFieldCell.tsx (70%), non un nuovo numero inventato. */
const LOW_CONFIDENCE_THRESHOLD = 0.7;

export interface CaseBlockerReason {
  text: string;
  href: string;
}

export interface CaseBlockerInput {
  problematicCount: number;
  needsHumanReview: boolean;
  confidence: number | null;
  assignedToId: string | null;
  anomalyReason: string | null;
  securityFlagsCount: number;
  pendingRelationsCount: number;
}

/**
 * Stessa lista di blocker mostrata in "Prossima azione"/"Segna completata" (dettaglio
 * pratica) — unica fonte di verità, riusata anche server-side per rifiutare transizioni di
 * stato bloccate (docs/UX-AUDIT-2026-07.md, P0 #3): nessuna nuova logica di business, solo lo
 * stesso calcolo già esistente reso condiviso tra pagina ed endpoint.
 */
export function deriveCaseBlockers(input: CaseBlockerInput): CaseBlockerReason[] {
  const blockers: CaseBlockerReason[] = [];
  if (input.problematicCount > 0) {
    blockers.push({ text: `${input.problematicCount} dato/i mancante/i o da verificare`, href: "#dati-estratti" });
  }
  if (input.needsHumanReview) {
    blockers.push({ text: "La pratica richiede revisione umana", href: "#dati-estratti" });
  }
  if (input.confidence !== null && input.confidence < LOW_CONFIDENCE_THRESHOLD) {
    blockers.push({ text: `Confidenza classificazione bassa (${Math.round(input.confidence * 100)}%)`, href: "#sintesi" });
  }
  if (!input.assignedToId) {
    blockers.push({ text: "Nessun responsabile assegnato", href: "#sintesi" });
  }
  if (input.anomalyReason) {
    blockers.push({ text: `Anomalia fattura: ${input.anomalyReason}`, href: "#dati-estratti" });
  }
  if (input.securityFlagsCount > 0) {
    blockers.push({ text: `${input.securityFlagsCount} segnale/i di sicurezza rilevato/i nelle email`, href: "#email" });
  }
  if (input.pendingRelationsCount > 0) {
    blockers.push({ text: `${input.pendingRelationsCount} collegamento/i pratica da verificare`, href: "#relazioni" });
  }
  return blockers;
}

/**
 * Ricarica solo i dati necessari per calcolare i blocker di una pratica dato il suo id —
 * usato dagli endpoint che devono rivalidare lato server senza il caseRecord già caricato
 * dalla pagina (PATCH /api/cases/[id]/status, P0 #3: il bottone disabilitato lato client non
 * è mai l'unica barriera).
 */
export async function getCaseBlockers(caseId: string): Promise<CaseBlockerReason[]> {
  const caseRecord = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      needsHumanReview: true,
      confidence: true,
      assignedToId: true,
      fields: { select: { fieldKey: true, value: true, needsHumanReview: true, confirmedBy: { select: { name: true } } } },
      messages: { select: { securityFlags: true } },
      relationsAsSource: { where: { status: "PENDING" }, select: { id: true } },
    },
  });
  if (!caseRecord) return [];

  const problematicCount = caseRecord.fields.filter((f) => classifyFieldTier(f) === "problematic").length;
  const anomalyReason = caseRecord.fields.find((f) => f.fieldKey === "anomaly_reason")?.value ?? null;
  const securityFlagsCount = new Set(
    caseRecord.messages.flatMap((m) => (Array.isArray(m.securityFlags) ? (m.securityFlags as string[]) : [])),
  ).size;

  return deriveCaseBlockers({
    problematicCount,
    needsHumanReview: caseRecord.needsHumanReview,
    confidence: caseRecord.confidence,
    assignedToId: caseRecord.assignedToId,
    anomalyReason,
    securityFlagsCount,
    pendingRelationsCount: caseRecord.relationsAsSource.length,
  });
}
