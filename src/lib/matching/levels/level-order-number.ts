import { findOrderNumber } from "@/lib/text/patterns";
import type { CaseRepository, MatchEmailInput } from "../types";

export async function levelOrderNumber(input: MatchEmailInput, repo: CaseRepository) {
  const orderNumber = findOrderNumber(`${input.subject}\n${input.bodyText}`);
  if (!orderNumber) return null;
  const found = await repo.findCaseByOrderNumber(orderNumber);
  return found ? { caseId: found.caseId, confidence: 0.85, level: "order_number" as const } : null;
}
