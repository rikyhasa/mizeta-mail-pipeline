export interface RecommendedActionData {
  label: string;
  description: string;
  href: string;
}

/** Pura, nessuna nuova logica di business: deriva un solo suggerimento dalla stessa lista di
 * "blocker" usata da ClosurePanel (fonte di verità unica, FASE 8B). Se non ci sono blocker ma
 * c'è una bozza in attesa di approvazione, la segnala; altrimenti nessuna azione consigliata. */
export function deriveRecommendedAction({
  blockers,
  blockerHrefs,
  activeDraftStatus,
}: {
  blockers: string[];
  blockerHrefs: string[];
  activeDraftStatus: string | null;
}): RecommendedActionData | null {
  if (blockers.length > 0) {
    return {
      label: blockers[0],
      description: blockers.length > 1 ? `+ ${blockers.length - 1} altro/i punto/i da verificare` : "",
      href: blockerHrefs[0],
    };
  }
  if (activeDraftStatus === "PENDING_APPROVAL") {
    return { label: "Approva bozza", description: "Bozza generata in attesa di approvazione", href: "#bozza" };
  }
  return null;
}
