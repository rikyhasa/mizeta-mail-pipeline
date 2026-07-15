import type { Rule } from "../types";

export const possibleDuplicateRule: Rule = {
  id: "possible_duplicate",
  evaluate(ctx) {
    if (!ctx.possibleDuplicate) return null;
    return { needsHumanReview: true, reason: "Possibile pratica duplicata o correlata da verificare" };
  },
};
