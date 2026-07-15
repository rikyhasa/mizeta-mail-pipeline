import type { Rule } from "../types";

export const amountMismatchRule: Rule = {
  id: "amount_mismatch",
  evaluate(ctx) {
    if (!ctx.amountMismatchDetected) return null;
    return { priority: "HIGH", needsHumanReview: true, reason: "Importo discordante fra corpo email e allegato" };
  },
};
