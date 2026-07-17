import type { CaseBlockerKind, CaseBlockerReason } from "@/lib/cases/blockers";

export interface RecommendedActionData {
  label: string;
  description: string;
  href: string;
  /** Testo del bottone: un verbo concreto quando il blocker lo permette, altrimenti "Vai"
   * generico (docs/UX-AUDIT-2026-07.md, punto 3.3.4). */
  ctaLabel: string;
}

/** Un verbo per categoria di blocker, non per singolo testo (che include conteggi/dettagli
 * variabili) — evita di fare pattern matching fragile sul testo tradotto. */
const CTA_LABEL_BY_BLOCKER_KIND: Record<CaseBlockerKind, string> = {
  missing_fields: "Completa i dati",
  needs_review: "Verifica i dati",
  low_confidence: "Verifica la classificazione",
  no_assignee: "Assegna un responsabile",
  anomaly: "Controlla l'anomalia",
  security_flags: "Controlla le email",
  pending_relations: "Verifica i collegamenti",
};

/** Pura, nessuna nuova logica di business: deriva un solo suggerimento dalla stessa lista di
 * "blocker" usata da ClosurePanel (fonte di verità unica, FASE 8B). Se non ci sono blocker ma
 * c'è una bozza in attesa di approvazione, la segnala; altrimenti nessuna azione consigliata. */
export function deriveRecommendedAction({
  blockers,
  activeDraftStatus,
}: {
  blockers: CaseBlockerReason[];
  activeDraftStatus: string | null;
}): RecommendedActionData | null {
  if (blockers.length > 0) {
    const first = blockers[0];
    return {
      label: first.text,
      description: blockers.length > 1 ? `+ ${blockers.length - 1} altro/i punto/i da verificare` : "",
      href: first.href,
      ctaLabel: CTA_LABEL_BY_BLOCKER_KIND[first.kind] ?? "Vai",
    };
  }
  if (activeDraftStatus === "PENDING_APPROVAL") {
    return { label: "Approva bozza", description: "Bozza generata in attesa di approvazione", href: "#bozza", ctaLabel: "Approva la bozza" };
  }
  return null;
}
