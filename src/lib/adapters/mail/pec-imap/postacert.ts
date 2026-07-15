import type { PecMessageType } from "@/generated/prisma/enums";

/**
 * Rileva il tipo di messaggio PEC dall'oggetto (SPEC.md §3), secondo le convenzioni reali
 * usate dai gestori italiani (Aruba, Legalmail, ecc.):
 * - "POSTA CERTIFICATA: <oggetto originale>" → messaggio vero e proprio.
 * - "ACCETTAZIONE: <oggetto originale>" → ricevuta di accettazione (presa in carico dal
 *   gestore del mittente).
 * - "AVVENUTA CONSEGNA: <oggetto originale>" → ricevuta di consegna (recapitato al gestore
 *   del destinatario).
 * - "MANCATA CONSEGNA: <oggetto originale>" → ricevuta di mancata consegna (errore).
 * Nessuna di queste ricevute genera una nuova pratica: si collegano sempre alla pratica del
 * messaggio originale (SPEC.md §3, §7) — logica già gestita in modo generico e indipendente
 * dal provider da `runPipelineForMessage`/`matchEmailToCase` (vedi `match.isPecReceipt`).
 */
export function detectPecMessageType(subject: string): PecMessageType {
  const normalized = subject.trim().toUpperCase();
  if (normalized.startsWith("ACCETTAZIONE:")) return "ACCEPTANCE_RECEIPT";
  if (normalized.startsWith("AVVENUTA CONSEGNA:")) return "DELIVERY_RECEIPT";
  if (normalized.startsWith("MANCATA CONSEGNA:")) return "NON_DELIVERY_RECEIPT";
  return "MESSAGE";
}

/**
 * Estrae il messaggio originale dalla "busta di trasporto" PEC (postacert.eml).
 *
 * NON implementata in questa fase (SPEC.md §3 consente esplicitamente di lasciare
 * `pec_imap` come scheletro documentato). Documentazione della struttura reale per una
 * futura implementazione:
 *
 * Un messaggio PEC arriva come un'email MIME `multipart/mixed` il cui corpo contiene
 * tipicamente:
 *   1. Una parte testuale/HTML con un avviso standard del gestore ("Il presente
 *      messaggio... certifica l'invio...").
 *   2. `daticert.xml` — allegato XML con i metadati di certificazione (mittente,
 *      destinatari, data/ora, identificativo del gestore, esito).
 *   3. `postacert.eml` — il VERO messaggio originale (o la ricevuta), come file
 *      `message/rfc822` annidato: un'email RFC 822 completa (header + corpo + eventuali
 *      allegati originali), incapsulata dentro la busta di trasporto.
 *
 * Per estrarre il messaggio reale servirebbe: 1) parsare il MIME esterno per isolare la
 * parte `postacert.eml` (content-type `message/rfc822`); 2) parsare quel contenuto come
 * una seconda email RFC 822 completa (richiede una libreria di parsing MIME/RFC822, es.
 * `mailparser` — non aggiunta in questa fase, non giustificata senza un adapter
 * funzionante); 3) mappare il risultato su `RawEmailMessage` esattamente come fa
 * `microsoft365`, preservando `isPec: true` e il `pecMessageType` rilevato da
 * `detectPecMessageType` sull'oggetto della busta esterna.
 */
export function parsePostacertEnvelope(_raw: Buffer): never {
  throw new Error(
    "pec_imap: parsePostacertEnvelope non implementato in questa fase — vedi docs/email-integration.md e il commento in questo file per la struttura di postacert.eml.",
  );
}
