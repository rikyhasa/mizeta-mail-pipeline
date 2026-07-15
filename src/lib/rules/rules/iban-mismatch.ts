import type { Rule } from "../types";

export const ibanMismatchRule: Rule = {
  id: "iban_mismatch",
  evaluate(ctx) {
    if (!ctx.ibanMismatch) return null;
    return { needsHumanReview: true, reason: "IBAN estratto diverso da quello storico del fornitore" };
  },
};
