import type {
  HealthStatus,
  MailChange,
  MailProviderAdapter,
  RawAttachment,
  RawEmailMessage,
} from "@/lib/adapters/mail/types";

const NOT_IMPLEMENTED =
  "PecImapProviderAdapter non implementato in questa fase: solo interfaccia/scheletro documentato (SPEC.md §3). Vedi docs/email-integration.md.";

/**
 * Scheletro documentato, NON funzionante in questa fase — stesso pattern di
 * `OpenAILLMProvider` (Fase 2): interfaccia completa, implementazione assente, ogni
 * metodo lancia un errore esplicito e comprensibile.
 *
 * Una implementazione reale farebbe polling IMAP (host/porta/utente/password già in
 * `env.PEC_IMAP_*`, non ancora usati) a intervallo configurabile — la PEC non ha
 * notifiche push. Per ogni messaggio: rilevare il tipo con `detectPecMessageType`,
 * ed estrarre il messaggio originale dalla busta di trasporto con
 * `parsePostacertEnvelope` (vedi `postacert.ts` per la struttura MIME completa).
 *
 * `healthCheck` è l'unica eccezione che non lancia: ritorna sempre `"degraded"`, così
 * la pagina Impostazioni può comunque mostrare la riga di una mailbox PEC configurata
 * senza che l'intera pagina fallisca.
 */
export class PecImapProviderAdapter implements MailProviderAdapter {
  async connectAccount(_input: {
    emailAddress: string;
    displayName: string;
    isPec?: boolean;
  }): Promise<{ externalAccountId: string }> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async disconnectAccount(_externalAccountId: string): Promise<void> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async renewSubscription(_externalAccountId: string): Promise<{ expiresAt: Date }> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async fetchMessage(_externalAccountId: string, _providerMessageId: string): Promise<RawEmailMessage> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async fetchThread(_externalAccountId: string, _providerThreadId: string): Promise<RawEmailMessage[]> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async fetchAttachment(
    _externalAccountId: string,
    _providerMessageId: string,
    _attachmentId: string,
  ): Promise<RawAttachment> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async listChanges(
    _externalAccountId: string,
    _cursor: string | null,
  ): Promise<{ changes: MailChange[]; nextCursor: string | null }> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async markProcessingResult(
    _externalAccountId: string,
    _providerMessageId: string,
    _result: { ok: boolean; error?: string },
  ): Promise<void> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async healthCheck(_externalAccountId: string): Promise<HealthStatus> {
    return {
      status: "degraded",
      message: "pec_imap resta uno scheletro documentato in questa fase: nessuna connessione reale.",
      checkedAt: new Date(),
    };
  }
}
