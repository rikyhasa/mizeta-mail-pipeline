import type { CaseRepository, MatchEmailInput } from "../types";

/**
 * Proxy semplificato del livello "cliente + tratta + intervallo temporale" (SPEC.md §7, §12):
 * stesso mittente + stessa categoria entro una finestra temporale. Confidenza volutamente bassa
 * (mai sufficiente da sola per l'auto-link con la soglia di default).
 */
export async function levelRecentSender(input: MatchEmailInput, repo: CaseRepository, windowDays: number) {
  const found = await repo.findCaseBySameSenderRecently({
    mailboxConnectionId: input.mailboxConnectionId,
    fromAddress: input.fromAddress,
    category: input.category,
    aroundDate: input.receivedAt,
    windowDays,
  });
  return found ? { caseId: found.caseId, confidence: 0.6, level: "recent_sender" as const } : null;
}
