import type { Rule } from "../types";

export const deadlineOverdueRule: Rule = {
  id: "deadline_overdue",
  evaluate(ctx) {
    const overdue = ctx.deadlines.find((d) => d.dueAt.getTime() < ctx.now.getTime());
    if (!overdue) return null;
    const critical = overdue.kind === "PAYMENT_REDUCED_DUE" || overdue.kind === "RESPONSE_DUE";
    return {
      priority: critical ? "CRITICAL" : "HIGH",
      needsHumanReview: true,
      reason: `Scadenza superata (${overdue.kind})`,
    };
  },
};
