import type { CaseRepository, MatchEmailInput } from "../types";

export async function levelMessageId(input: MatchEmailInput, repo: CaseRepository) {
  if (!input.inReplyTo && input.references.length === 0) return null;
  const found = await repo.findCaseByMessageIdentifiers(input.mailboxConnectionId, {
    internetMessageId: null,
    inReplyTo: input.inReplyTo,
    references: input.references,
  });
  return found ? { caseId: found.caseId, confidence: 0.95, level: "message_id" as const } : null;
}
