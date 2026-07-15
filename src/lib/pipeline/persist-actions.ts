import type { Prisma } from "@/generated/prisma/client";
import type { ProcessMessageResult } from "./types";

/**
 * Persiste l'esito del terzo passaggio (proposta azioni, SPEC.md §6). Non crea Task reali: il
 * risultato resta nel JSON di ActionProposalRun, pronto per essere trasformato in attività
 * concrete dall'azione "aggiungi attività" della UI di Fase 3.
 */
export async function persistActions(
  tx: Prisma.TransactionClient,
  providerName: string,
  caseId: string,
  result: Pick<ProcessMessageResult, "actionProposal" | "now">,
): Promise<void> {
  const { actionProposal, now } = result;
  if (!actionProposal) return;

  await tx.actionProposalRun.create({
    data: {
      caseId,
      llmProvider: providerName,
      model: actionProposal.model,
      status: "SUCCEEDED",
      resultJson: actionProposal.data as Prisma.InputJsonValue,
      inputTokens: actionProposal.usage.inputTokens,
      outputTokens: actionProposal.usage.outputTokens,
      costUsd: actionProposal.usage.costUsd,
      startedAt: now,
      finishedAt: now,
    },
  });
}
