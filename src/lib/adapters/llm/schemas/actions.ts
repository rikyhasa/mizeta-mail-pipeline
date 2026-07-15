import { z } from "zod";

const DEPARTMENT_VALUES = ["OPERATIONS", "ACCOUNTING", "COMMERCIAL", "MANAGEMENT"] as const;

export const proposedTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable(),
  suggested_department: z.enum(DEPARTMENT_VALUES).nullable(),
  suggested_due_at: z.string().nullable(),
});

/**
 * Structured Output del terzo passaggio della pipeline (SPEC.md §6): SOLO proposta di azioni.
 * `draft_reply_reason` spiega perché servirebbe una bozza — mai il testo della bozza vera e
 * propria, che è generazione di Fase 3 (§11) e richiede sempre approvazione umana esplicita.
 */
export const proposeActionsResultSchema = z.object({
  suggested_actions: z.array(z.string()),
  proposed_tasks: z.array(proposedTaskSchema),
  responsible_department: z.enum(DEPARTMENT_VALUES).nullable(),
  draft_reply_recommended: z.boolean(),
  draft_reply_reason: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  needs_human_review: z.boolean(),
});

export type ProposedTask = z.infer<typeof proposedTaskSchema>;
export type ProposeActionsResult = z.infer<typeof proposeActionsResultSchema>;
