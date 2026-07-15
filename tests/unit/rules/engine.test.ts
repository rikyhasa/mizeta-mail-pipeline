import { describe, expect, it } from "vitest";
import { applyRules } from "@/lib/rules/engine";
import { DEFAULT_RULE_SETTINGS } from "@/lib/rules/default-settings";
import type { RuleBaseline, RuleContext } from "@/lib/rules/types";

const NOW = new Date("2026-07-12T09:00:00Z");

function baseline(overrides: Partial<RuleBaseline> = {}): RuleBaseline {
  return { priority: "NORMAL", status: "NEW", needsHumanReview: false, reasons: [], ...overrides };
}

function ctx(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    category: "OTHER",
    deadlines: [],
    hasUnreadableAttachment: false,
    possibleDuplicate: false,
    amountMismatchDetected: false,
    ibanMismatch: false,
    claimRequestedAmount: null,
    quoteResponseDueAt: null,
    classificationConfidence: 0.9,
    now: NOW,
    ...overrides,
  };
}

describe("motore di regole (SPEC.md §8)", () => {
  it("deadline_overdue: scadenza superata escala almeno a HIGH", () => {
    const result = applyRules(baseline(), ctx({ deadlines: [{ kind: "PAYMENT_DUE", dueAt: new Date("2026-07-01T00:00:00Z") }] }), DEFAULT_RULE_SETTINGS);
    expect(result.priority).toBe("HIGH");
    expect(result.needsHumanReview).toBe(true);
  });

  it("deadline_overdue: scadenza di risposta superata escala a CRITICAL", () => {
    const result = applyRules(baseline(), ctx({ deadlines: [{ kind: "RESPONSE_DUE", dueAt: new Date("2026-07-01T00:00:00Z") }] }), DEFAULT_RULE_SETTINGS);
    expect(result.priority).toBe("CRITICAL");
  });

  it("deadline_within_24h: scadenza entro la soglia configurata escala a CRITICAL", () => {
    const result = applyRules(baseline(), ctx({ deadlines: [{ kind: "PICKUP_DUE", dueAt: new Date("2026-07-12T20:00:00Z") }] }), DEFAULT_RULE_SETTINGS);
    expect(result.priority).toBe("CRITICAL");
  });

  it("fine_reduced_deadline_critical: solo per FINE_OR_PENALTY con termine ridotto entro la finestra", () => {
    const result = applyRules(
      baseline(),
      ctx({ category: "FINE_OR_PENALTY", deadlines: [{ kind: "PAYMENT_REDUCED_DUE", dueAt: new Date("2026-07-13T12:00:00Z") }] }),
      DEFAULT_RULE_SETTINGS,
    );
    expect(result.priority).toBe("CRITICAL");
    expect(result.triggeredRules).toContain("fine_reduced_deadline_critical");
  });

  it("claim_amount_high: solo per CLAIM_OR_DAMAGE con importo sopra soglia", () => {
    const result = applyRules(baseline(), ctx({ category: "CLAIM_OR_DAMAGE", claimRequestedAmount: 5000 }), DEFAULT_RULE_SETTINGS);
    expect(result.priority).toBe("HIGH");
  });

  it("claim_amount_high: non scatta sotto soglia", () => {
    const result = applyRules(baseline(), ctx({ category: "CLAIM_OR_DAMAGE", claimRequestedAmount: 100 }), DEFAULT_RULE_SETTINGS);
    expect(result.triggeredRules).not.toContain("claim_amount_high");
  });

  it("quote_same_day_response: preventivo con risposta richiesta entro la finestra escala a HIGH", () => {
    const result = applyRules(baseline(), ctx({ category: "QUOTE_REQUEST", quoteResponseDueAt: new Date("2026-07-12T11:00:00Z") }), DEFAULT_RULE_SETTINGS);
    expect(result.priority).toBe("HIGH");
  });

  it("iban_mismatch: forza needs_human_review", () => {
    const result = applyRules(baseline(), ctx({ ibanMismatch: true }), DEFAULT_RULE_SETTINGS);
    expect(result.needsHumanReview).toBe(true);
    expect(result.status).toBe("NEEDS_REVIEW");
  });

  it("possible_duplicate: forza needs_human_review", () => {
    const result = applyRules(baseline(), ctx({ possibleDuplicate: true }), DEFAULT_RULE_SETTINGS);
    expect(result.needsHumanReview).toBe(true);
  });

  it("low_confidence: sotto la soglia configurata forza needs_human_review", () => {
    const result = applyRules(baseline(), ctx({ classificationConfidence: 0.2 }), DEFAULT_RULE_SETTINGS);
    expect(result.needsHumanReview).toBe(true);
  });

  it("unreadable_attachment: forza needs_human_review, mai inventare dati", () => {
    const result = applyRules(baseline(), ctx({ hasUnreadableAttachment: true }), DEFAULT_RULE_SETTINGS);
    expect(result.needsHumanReview).toBe(true);
  });

  it("amount_mismatch: escala a HIGH e forza needs_human_review", () => {
    const result = applyRules(baseline(), ctx({ amountMismatchDetected: true }), DEFAULT_RULE_SETTINGS);
    expect(result.priority).toBe("HIGH");
    expect(result.needsHumanReview).toBe(true);
  });

  it("composizione: le regole possono solo escalare, mai fare downgrade di una priorità già alta", () => {
    const result = applyRules(baseline({ priority: "CRITICAL" }), ctx({}), DEFAULT_RULE_SETTINGS);
    expect(result.priority).toBe("CRITICAL");
  });

  it("composizione: una baseline LOW con una regola che esplode a CRITICAL produce CRITICAL finale", () => {
    const result = applyRules(baseline({ priority: "LOW" }), ctx({ deadlines: [{ kind: "RESPONSE_DUE", dueAt: new Date("2026-07-01T00:00:00Z") }] }), DEFAULT_RULE_SETTINGS);
    expect(result.priority).toBe("CRITICAL");
  });

  it("il motore deterministico può sovrascrivere la classificazione, mai il contrario: needsHumanReview è un OR monotono", () => {
    const result = applyRules(baseline({ needsHumanReview: false }), ctx({ possibleDuplicate: true }), DEFAULT_RULE_SETTINGS);
    expect(result.needsHumanReview).toBe(true);
  });

  it("nessuna regola attiva: la baseline della classificazione resta invariata", () => {
    const result = applyRules(baseline({ priority: "NORMAL", needsHumanReview: false }), ctx({}), DEFAULT_RULE_SETTINGS);
    expect(result.priority).toBe("NORMAL");
    expect(result.needsHumanReview).toBe(false);
    expect(result.triggeredRules).toEqual([]);
  });
});
