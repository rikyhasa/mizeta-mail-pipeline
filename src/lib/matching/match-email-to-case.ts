import type { CaseRepository, MatchEmailInput, MatchResult, MatchSettings } from "./types";
import { resolvePecReceipt } from "./levels/level-pec-receipt";
import { levelProviderThread } from "./levels/level-provider-thread";
import { levelMessageId } from "./levels/level-message-id";
import { levelInvoiceNumber } from "./levels/level-invoice-number";
import { levelOrderNumber } from "./levels/level-order-number";
import { levelShipmentNumber } from "./levels/level-shipment-number";
import { levelFineNumber } from "./levels/level-fine-number";
import { levelRecentSender } from "./levels/level-recent-sender";
import { levelSemanticSimilarity } from "./levels/level-semantic-similarity";

const RECENT_SENDER_WINDOW_DAYS = 30;

/**
 * Cascata di associazione email→pratica (SPEC.md §7). Deterministica, TypeScript puro, mai
 * chiamate LLM. Le ricevute PEC si collegano sempre alla pratica del messaggio originale, mai
 * ne creano una nuova. Sotto la soglia di auto-link ma sopra quella di "possibile duplicato":
 * crea comunque una nuova pratica e segnala il candidato più forte per la coda di revisione
 * umana — mai un merge automatico a bassa confidenza.
 */
export async function matchEmailToCase(
  input: MatchEmailInput,
  repo: CaseRepository,
  settings: MatchSettings,
): Promise<MatchResult> {
  if (input.isPec && input.pecMessageType && input.pecMessageType !== "MESSAGE") {
    const resolved = await resolvePecReceipt(input, repo);
    if (resolved) {
      return { caseId: resolved.caseId, level: "pec_receipt", confidence: 1, isPecReceipt: true };
    }
    // Ricevuta non risolvibile: nessuna pratica creata, ma nessuna perdita silenziosa —
    // l'orchestratore la segnala per revisione umana.
    return { caseId: null, level: "none", confidence: 0, isPecReceipt: true };
  }

  const levels = [
    () => levelProviderThread(input, repo),
    () => levelMessageId(input, repo),
    () => levelInvoiceNumber(input, repo),
    () => levelOrderNumber(input, repo),
    () => levelShipmentNumber(input, repo),
    () => levelFineNumber(input, repo),
    () => levelRecentSender(input, repo, RECENT_SENDER_WINDOW_DAYS),
    () => levelSemanticSimilarity(input, repo),
  ];

  let bestWeak: MatchResult["possibleDuplicateOf"];

  for (const level of levels) {
    const candidate = await level();
    if (!candidate) continue;

    if (candidate.confidence >= settings.autoLinkConfidenceThreshold) {
      return { caseId: candidate.caseId, level: candidate.level, confidence: candidate.confidence, isPecReceipt: false };
    }
    if (candidate.confidence >= settings.possibleDuplicateConfidenceThreshold) {
      if (!bestWeak || candidate.confidence > bestWeak.confidence) {
        bestWeak = { caseId: candidate.caseId, confidence: candidate.confidence, level: candidate.level };
      }
    }
  }

  return { caseId: null, level: "none", confidence: 0, isPecReceipt: false, possibleDuplicateOf: bestWeak };
}
