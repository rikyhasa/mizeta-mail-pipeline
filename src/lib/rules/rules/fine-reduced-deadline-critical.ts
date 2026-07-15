import type { Rule } from "../types";

export const fineReducedDeadlineCriticalRule: Rule = {
  id: "fine_reduced_deadline_critical",
  evaluate(ctx, settings) {
    if (ctx.category !== "FINE_OR_PENALTY") return null;
    const reduced = ctx.deadlines.find((d) => d.kind === "PAYMENT_REDUCED_DUE");
    if (!reduced) return null;
    const windowMs = settings.fineReducedDeadlineCriticalWithinHours * 60 * 60 * 1000;
    const diff = reduced.dueAt.getTime() - ctx.now.getTime();
    if (diff < 0 || diff > windowMs) return null;
    return { priority: "CRITICAL", reason: `Multa con termine ridotto entro ${settings.fineReducedDeadlineCriticalWithinHours}h` };
  },
};
