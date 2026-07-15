import { describe, expect, it } from "vitest";
import { classificationResultSchema } from "@/lib/adapters/llm/schemas";

const VALID = {
  primary_category: "QUOTE_REQUEST",
  secondary_categories: [],
  short_title: "Titolo",
  summary: "Sintesi",
  action_required: true,
  suggested_actions: [],
  priority: "NORMAL",
  priority_reasons: [],
  deadline: null,
  responsible_department: null,
  customer_or_supplier: null,
  related_business_identifiers: [],
  confidence: 0.8,
  needs_human_review: false,
  security_flags: [],
};

describe("classificationResultSchema", () => {
  it("accepts a valid payload", () => {
    expect(() => classificationResultSchema.parse(VALID)).not.toThrow();
  });

  it("rejects a category outside the allowlist (the model cannot invent enums)", () => {
    expect(() =>
      classificationResultSchema.parse({ ...VALID, primary_category: "NOT_A_REAL_CATEGORY" }),
    ).toThrow();
  });

  it("rejects confidence outside the [0,1] range", () => {
    expect(() => classificationResultSchema.parse({ ...VALID, confidence: 1.5 })).toThrow();
  });

  it("rejects a payload missing a required field", () => {
    const { summary: _summary, ...missingSummary } = VALID;
    expect(() => classificationResultSchema.parse(missingSummary)).toThrow();
  });
});
