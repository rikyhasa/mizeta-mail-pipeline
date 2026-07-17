import { describe, expect, it } from "vitest";
import { deriveCaseBlockers, type CaseBlockerInput } from "@/lib/cases/blockers";

const BASE: CaseBlockerInput = {
  problematicCount: 0,
  needsHumanReview: false,
  confidence: null,
  assignedToId: "user-1",
  anomalyReason: null,
  securityFlagsCount: 0,
  pendingRelationsCount: 0,
};

describe("deriveCaseBlockers", () => {
  it("returns no blockers when the case is clean", () => {
    expect(deriveCaseBlockers(BASE)).toEqual([]);
  });

  it("flags missing/unverified fields", () => {
    const blockers = deriveCaseBlockers({ ...BASE, problematicCount: 3 });
    expect(blockers).toEqual([{ text: "3 dato/i mancante/i o da verificare", href: "#dati-estratti", kind: "missing_fields" }]);
  });

  it("flags a case that still needs human review", () => {
    const blockers = deriveCaseBlockers({ ...BASE, needsHumanReview: true });
    expect(blockers).toEqual([{ text: "La pratica richiede revisione umana", href: "#dati-estratti", kind: "needs_review" }]);
  });

  it("flags low classification confidence, but not confidence above the threshold", () => {
    expect(deriveCaseBlockers({ ...BASE, confidence: 0.5 })).toEqual([
      { text: "Confidenza classificazione bassa (50%)", href: "#sintesi", kind: "low_confidence" },
    ]);
    expect(deriveCaseBlockers({ ...BASE, confidence: 0.9 })).toEqual([]);
  });

  it("flags a missing responsabile", () => {
    const blockers = deriveCaseBlockers({ ...BASE, assignedToId: null });
    expect(blockers).toEqual([{ text: "Nessun responsabile assegnato", href: "#sintesi", kind: "no_assignee" }]);
  });

  it("flags an invoice anomaly", () => {
    const blockers = deriveCaseBlockers({ ...BASE, anomalyReason: "importo discordante" });
    expect(blockers).toEqual([{ text: "Anomalia fattura: importo discordante", href: "#dati-estratti", kind: "anomaly" }]);
  });

  it("flags detected security signals", () => {
    const blockers = deriveCaseBlockers({ ...BASE, securityFlagsCount: 2 });
    expect(blockers).toEqual([
      { text: "2 segnale/i di sicurezza rilevato/i nelle email", href: "#email", kind: "security_flags" },
    ]);
  });

  it("flags pending case relations", () => {
    const blockers = deriveCaseBlockers({ ...BASE, pendingRelationsCount: 1 });
    expect(blockers).toEqual([{ text: "1 collegamento/i pratica da verificare", href: "#relazioni", kind: "pending_relations" }]);
  });

  it("accumulates every applicable blocker at once", () => {
    const blockers = deriveCaseBlockers({
      problematicCount: 2,
      needsHumanReview: true,
      confidence: 0.4,
      assignedToId: null,
      anomalyReason: "importo discordante",
      securityFlagsCount: 1,
      pendingRelationsCount: 1,
    });
    expect(blockers).toHaveLength(7);
  });
});
