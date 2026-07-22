import type { CaseRepository, MatchEmailInput } from "../types";

/**
 * Proxy semplificato del livello "cliente + tratta + intervallo temporale" (SPEC.md §7, §12):
 * stesso mittente + stessa categoria entro una finestra temporale. Confidenza volutamente bassa
 * (mai sufficiente da sola per l'auto-link con la soglia di default).
 *
 * Esclusa per FINE_OR_PENALTY: mittenti istituzionali ad alto volume (comuni, polizia locale)
 * inviano normalmente più multe distinte alla stessa azienda nella stessa finestra — "stesso
 * mittente" da solo non è un segnale di duplicato in questa categoria. Il vero duplicato (stesso
 * verbale rinviato) resta coperto con confidenza più alta da `levelFineNumber`.
 */
export async function levelRecentSender(input: MatchEmailInput, repo: CaseRepository, windowDays: number) {
  if (input.category === "FINE_OR_PENALTY") return null;

  const found = await repo.findCaseBySameSenderRecently({
    mailboxConnectionId: input.mailboxConnectionId,
    fromAddress: input.fromAddress,
    category: input.category,
    aroundDate: input.receivedAt,
    windowDays,
  });
  return found ? { caseId: found.caseId, confidence: 0.6, level: "recent_sender" as const } : null;
}
