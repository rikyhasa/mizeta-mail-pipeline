import type { CaseRepository, MatchEmailInput } from "../types";

export async function levelProviderThread(input: MatchEmailInput, repo: CaseRepository) {
  const found = await repo.findCaseByProviderThread(input.mailboxConnectionId, input.providerThreadId);
  return found ? { caseId: found.caseId, confidence: 1.0, level: "provider_thread" as const } : null;
}
