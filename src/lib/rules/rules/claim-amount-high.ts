import type { Rule } from "../types";

export const claimAmountHighRule: Rule = {
  id: "claim_amount_high",
  evaluate(ctx, settings) {
    if (ctx.category !== "CLAIM_OR_DAMAGE") return null;
    if (ctx.claimRequestedAmount === null || ctx.claimRequestedAmount < settings.claimAmountHighThreshold) return null;
    return { priority: "HIGH", reason: `Importo del danno richiesto ≥ ${settings.claimAmountHighThreshold} EUR` };
  },
};
