import { findShipmentReference } from "@/lib/text/patterns";
import type { CaseRepository, MatchEmailInput } from "../types";

export async function levelShipmentNumber(input: MatchEmailInput, repo: CaseRepository) {
  const reference = findShipmentReference(`${input.subject}\n${input.bodyText}`);
  if (!reference) return null;
  const found = await repo.findCaseByShipmentReference(reference);
  return found ? { caseId: found.caseId, confidence: 0.85, level: "shipment_number" as const } : null;
}
