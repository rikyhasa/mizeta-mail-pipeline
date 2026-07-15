import type { CaseRepository, MatchEmailInput } from "../types";

/**
 * Risoluzione ricevute PEC (SPEC.md §3, §7): le ricevute si collegano SEMPRE alla pratica del
 * messaggio originale, mai creano una nuova pratica. Risolta via In-Reply-To/References su un
 * internetMessageId noto, oppure parsing dell'oggetto originale incorporato dal gestore PEC nel
 * testo della ricevuta stessa — MAI leggendo un campo fixture-only di comodo per il seed naive
 * di Fase 1. Puro parsing di metadati generati dal gestore PEC (non testo del mittente
 * originale): non viola l'invariante 1 (nessun comando eseguito).
 */
export async function resolvePecReceipt(input: MatchEmailInput, repo: CaseRepository): Promise<{ caseId: string } | null> {
  const byId = await repo.findCaseByMessageIdentifiers(input.mailboxConnectionId, {
    internetMessageId: null,
    inReplyTo: input.inReplyTo,
    references: input.references,
  });
  if (byId) return byId;

  const embeddedSubject = extractEmbeddedOriginalSubject(input.subject, input.bodyText);
  if (embeddedSubject) {
    const bySubject = await repo.findRecentMessageBySubject(input.mailboxConnectionId, embeddedSubject, input.receivedAt);
    if (bySubject) return bySubject;
  }
  return null;
}

function extractEmbeddedOriginalSubject(subject: string, body: string): string | null {
  const fromSubject =
    /^AVVISO DI CONSEGNA:\s*(.+)$/i.exec(subject)?.[1] ?? /^AVVISO DI (?:MANCATA )?ACCETTAZIONE:\s*(.+)$/i.exec(subject)?.[1];
  if (fromSubject) return fromSubject.trim();

  const fromBody = /Il messaggio\s+['’]([^'’]+)['’]/i.exec(body)?.[1];
  return fromBody?.trim() ?? null;
}
