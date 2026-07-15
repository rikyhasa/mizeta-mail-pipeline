import type { Rule } from "../types";

export const unreadableAttachmentRule: Rule = {
  id: "unreadable_attachment",
  evaluate(ctx) {
    if (!ctx.hasUnreadableAttachment) return null;
    return { needsHumanReview: true, reason: "Allegato illeggibile o corrotto" };
  },
};
