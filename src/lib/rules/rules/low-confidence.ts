import type { Rule } from "../types";

export const lowConfidenceRule: Rule = {
  id: "low_confidence",
  evaluate(ctx, settings) {
    if (ctx.classificationConfidence >= settings.classificationConfidenceThreshold) return null;
    return { needsHumanReview: true, reason: "Confidenza di classificazione sotto la soglia configurata" };
  },
};
