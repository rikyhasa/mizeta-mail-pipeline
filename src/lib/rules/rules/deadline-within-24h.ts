import type { Rule } from "../types";

export const deadlineWithin24hRule: Rule = {
  id: "deadline_within_24h",
  evaluate(ctx, settings) {
    const windowMs = settings.deadlineCriticalWithinHours * 60 * 60 * 1000;
    const soon = ctx.deadlines.find((d) => {
      const diff = d.dueAt.getTime() - ctx.now.getTime();
      return diff >= 0 && diff <= windowMs;
    });
    if (!soon) return null;
    return { priority: "CRITICAL", reason: `Scadenza entro ${settings.deadlineCriticalWithinHours}h (${soon.kind})` };
  },
};
