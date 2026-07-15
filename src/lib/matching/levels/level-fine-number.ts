import { findFineNoticeNumber } from "@/lib/text/patterns";
import type { CaseRepository, MatchEmailInput } from "../types";

export async function levelFineNumber(input: MatchEmailInput, repo: CaseRepository) {
  const noticeNumber = findFineNoticeNumber(`${input.subject}\n${input.bodyText}`);
  if (!noticeNumber) return null;
  const found = await repo.findCaseByFineNoticeNumber(noticeNumber);
  return found ? { caseId: found.caseId, confidence: 0.9, level: "fine_number" as const } : null;
}
