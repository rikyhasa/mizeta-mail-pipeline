import type { Rule } from "../types";

export const quoteSameDayResponseRule: Rule = {
  id: "quote_same_day_response",
  evaluate(ctx, settings) {
    if (ctx.category !== "QUOTE_REQUEST" || !ctx.quoteResponseDueAt) return null;
    const windowMs = settings.quoteSameDayResponseWithinHours * 60 * 60 * 1000;
    const diff = ctx.quoteResponseDueAt.getTime() - ctx.now.getTime();
    if (diff < 0 || diff > windowMs) return null;
    return { priority: "HIGH", reason: `Risposta al preventivo richiesta entro ${settings.quoteSameDayResponseWithinHours}h` };
  },
};
