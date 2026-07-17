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
  enforcement: null,
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
      enforcement: null,
    });
    expect(blockers).toHaveLength(7);
  });

  it("returns no enforcement blocker when the module is not applicable (null)", () => {
    expect(deriveCaseBlockers(BASE)).toEqual([]);
  });

  it("flags a device still to be identified", () => {
    const blockers = deriveCaseBlockers({
      ...BASE,
      enforcement: { applicability: "TO_BE_IDENTIFIED", needsHumanReview: true, missingDocumentCount: 0 },
    });
    expect(blockers).toEqual([{ text: "Dispositivo di rilevamento da identificare", href: "#verifica-autovelox", kind: "enforcement_identify" }]);
  });

  it("flags device data still needing confirmation once identified", () => {
    const blockers = deriveCaseBlockers({
      ...BASE,
      enforcement: { applicability: "SPEED_CAMERA_FIXED", needsHumanReview: true, missingDocumentCount: 0 },
    });
    expect(blockers).toEqual([{ text: "Dati del dispositivo da confermare", href: "#verifica-autovelox", kind: "enforcement_missing_fields" }]);
  });

  it("does not flag missing-fields once the device check has been confirmed", () => {
    const blockers = deriveCaseBlockers({
      ...BASE,
      enforcement: { applicability: "SPEED_CAMERA_FIXED", needsHumanReview: false, missingDocumentCount: 0 },
    });
    expect(blockers).toEqual([]);
  });

  it("flags missing technical documents once the device is identified", () => {
    const blockers = deriveCaseBlockers({
      ...BASE,
      enforcement: { applicability: "SPEED_CAMERA_FIXED", needsHumanReview: false, missingDocumentCount: 3 },
    });
    expect(blockers).toEqual([{ text: "3 documento/i tecnico/i mancante/i", href: "#verifica-autovelox", kind: "enforcement_missing_docs" }]);
  });

  it("does not flag missing documents while the device is still unidentified (identify blocker takes priority)", () => {
    const blockers = deriveCaseBlockers({
      ...BASE,
      enforcement: { applicability: "TO_BE_IDENTIFIED", needsHumanReview: true, missingDocumentCount: 5 },
    });
    expect(blockers).toEqual([{ text: "Dispositivo di rilevamento da identificare", href: "#verifica-autovelox", kind: "enforcement_identify" }]);
  });
});
