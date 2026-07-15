import { randomUUID } from "node:crypto";
import { env } from "@/lib/config/env";
import type {
  HealthStatus,
  MailChange,
  MailProviderAdapter,
  RawAttachment,
  RawEmailMessage,
} from "@/lib/adapters/mail/types";
import { GraphApiError, type GraphClient } from "@/lib/adapters/mail/microsoft365/graph-http-client";
import {
  GRAPH_CHANGE_SELECT,
  GRAPH_MESSAGE_SELECT,
  GRAPH_TEXT_BODY_HEADER,
  type GraphDeltaPage,
  type GraphFileAttachment,
  type GraphMessage,
  type GraphMessagePage,
  type GraphSubscription,
  mapGraphAttachmentToRaw,
  mapGraphMessageToRaw,
} from "@/lib/adapters/mail/microsoft365/mappers";

/** Durata massima di una subscription Graph per risorse `message` (~2.94 giorni). Il worker
 * (RENEW_SUBSCRIPTION, SPEC.md §3) deve rinnovarla ben prima di questo margine. */
const MAX_SUBSCRIPTION_MINUTES = 4230;

function graphResourcePathFor(emailAddress: string): string {
  return `users/${emailAddress}/mailFolders('Inbox')/messages`;
}

function graphUserPath(emailAddress: string): string {
  return `/users/${encodeURIComponent(emailAddress)}`;
}

interface LastCreatedSubscription {
  subscriptionId: string;
  expiresAt: Date;
  clientState: string;
}

/**
 * Adapter Microsoft Graph reale (SPEC.md §3): change notifications (webhook) + delta query per
 * il recovery, rinnovo subscription, sync iniziale limitato. Riceve un `GraphClient` iniettato
 * (mai istanziato internamente), così i test possono passare un client finto senza credenziali
 * reali (requisito esplicito: "l'adapter M365 deve essere testabile con mock delle risposte
 * Graph").
 */
export class Microsoft365MailProviderAdapter implements MailProviderAdapter {
  private lastCreatedSubscription: LastCreatedSubscription | null = null;

  constructor(
    private readonly graph: GraphClient,
    private readonly notificationUrl: string = `${env.APP_URL}/api/webhooks/microsoft365`,
  ) {}

  async connectAccount(input: {
    emailAddress: string;
    displayName: string;
    isPec?: boolean;
  }): Promise<{ externalAccountId: string }> {
    const clientState = randomUUID();
    const expirationDateTime = new Date(Date.now() + MAX_SUBSCRIPTION_MINUTES * 60 * 1000);
    const subscription = await this.graph.request<GraphSubscription>("POST", "/subscriptions", {
      body: {
        changeType: "created,updated",
        notificationUrl: this.notificationUrl,
        resource: graphResourcePathFor(input.emailAddress),
        expirationDateTime: expirationDateTime.toISOString(),
        clientState,
      },
    });
    this.lastCreatedSubscription = {
      subscriptionId: subscription.id,
      expiresAt: new Date(subscription.expirationDateTime),
      clientState: subscription.clientState,
    };
    return { externalAccountId: input.emailAddress };
  }

  /**
   * NON fa parte dell'interfaccia comune `MailProviderAdapter` (mock/pec_imap non hanno un
   * concetto di subscription). Valido solo subito dopo `connectAccount`, sulla stessa istanza:
   * il chiamante (route di collegamento mailbox) lo legge una volta per persistere
   * subscriptionId/scadenza/clientState su `MailboxConnection`. Rinnovi ed health-check
   * successivi NON dipendono da questo stato in-memory: rileggono sempre lo stato reale da
   * Graph (vedi `findSubscriptionForMailbox`), così restano corretti anche se eseguiti da un
   * processo diverso (es. il job worker) rispetto a quello che ha creato la subscription.
   */
  getLastCreatedSubscription(): LastCreatedSubscription | null {
    return this.lastCreatedSubscription;
  }

  private async findSubscriptionForMailbox(externalAccountId: string): Promise<GraphSubscription | null> {
    const resourcePath = graphResourcePathFor(externalAccountId);
    const page = await this.graph.request<{ value: GraphSubscription[] }>("GET", "/subscriptions");
    return page.value.find((s) => s.resource === resourcePath) ?? null;
  }

  async disconnectAccount(externalAccountId: string): Promise<void> {
    const existing = await this.findSubscriptionForMailbox(externalAccountId);
    if (!existing) return;
    await this.graph.request("DELETE", `/subscriptions/${existing.id}`, { parseJson: false });
  }

  async renewSubscription(externalAccountId: string): Promise<{ expiresAt: Date }> {
    const existing = await this.findSubscriptionForMailbox(externalAccountId);
    if (!existing) {
      throw new Error(`Nessuna subscription Graph trovata da rinnovare per ${externalAccountId}.`);
    }
    const expirationDateTime = new Date(Date.now() + MAX_SUBSCRIPTION_MINUTES * 60 * 1000);
    const updated = await this.graph.request<GraphSubscription>("PATCH", `/subscriptions/${existing.id}`, {
      body: { expirationDateTime: expirationDateTime.toISOString() },
    });
    return { expiresAt: new Date(updated.expirationDateTime) };
  }

  async fetchMessage(externalAccountId: string, providerMessageId: string): Promise<RawEmailMessage> {
    const message = await this.graph.request<GraphMessage>(
      "GET",
      `${graphUserPath(externalAccountId)}/messages/${encodeURIComponent(providerMessageId)}`,
      { query: { $select: GRAPH_MESSAGE_SELECT }, headers: GRAPH_TEXT_BODY_HEADER },
    );
    return mapGraphMessageToRaw(message, externalAccountId);
  }

  async fetchThread(externalAccountId: string, providerThreadId: string): Promise<RawEmailMessage[]> {
    const page = await this.graph.request<GraphMessagePage>(
      "GET",
      `${graphUserPath(externalAccountId)}/messages`,
      {
        query: {
          $filter: `conversationId eq '${providerThreadId}'`,
          $select: GRAPH_MESSAGE_SELECT,
          $orderby: "receivedDateTime asc",
        },
        headers: GRAPH_TEXT_BODY_HEADER,
      },
    );
    return page.value.map((m) => mapGraphMessageToRaw(m, externalAccountId));
  }

  async fetchAttachment(
    externalAccountId: string,
    providerMessageId: string,
    attachmentId: string,
  ): Promise<RawAttachment> {
    const attachment = await this.graph.request<GraphFileAttachment>(
      "GET",
      `${graphUserPath(externalAccountId)}/messages/${encodeURIComponent(providerMessageId)}/attachments/${encodeURIComponent(attachmentId)}`,
    );
    return mapGraphAttachmentToRaw(attachment);
  }

  async listChanges(
    externalAccountId: string,
    cursor: string | null,
  ): Promise<{ changes: MailChange[]; nextCursor: string | null }> {
    if (cursor === null) return this.initialSync(externalAccountId);
    return this.followDelta(cursor);
  }

  /**
   * Sync iniziale limitato (SPEC.md §3): backfill bounded (`$top`/`$filter` per data), poi UNA
   * chiamata delta separata solo per ottenere il `deltaLink` di partenza — la delta query senza
   * cursore enumera OGNI messaggio esistente nella cartella (comportamento Graph non ovvio, vedi
   * docs/email-integration.md), quindi qui il contenuto di quella seconda chiamata viene
   * scartato: serve solo a stabilire il cursore di ripartenza per `listChanges` futuri.
   */
  private async initialSync(externalAccountId: string): Promise<{ changes: MailChange[]; nextCursor: string | null }> {
    const lookbackMs = env.MICROSOFT365_INITIAL_SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
    const sinceIso = new Date(Date.now() - lookbackMs).toISOString();
    const changes: MailChange[] = [];

    let nextLink: string | null = `${graphUserPath(externalAccountId)}/mailFolders('Inbox')/messages`;
    let query: Record<string, string | number> | undefined = {
      $top: env.MICROSOFT365_INITIAL_SYNC_MAX_MESSAGES,
      $orderby: "receivedDateTime desc",
      $filter: `receivedDateTime ge ${sinceIso}`,
      $select: GRAPH_CHANGE_SELECT,
    };

    while (nextLink && changes.length < env.MICROSOFT365_INITIAL_SYNC_MAX_MESSAGES) {
      const page: GraphMessagePage = await this.graph.request("GET", nextLink, query ? { query } : undefined);
      query = undefined;
      for (const message of page.value) {
        changes.push({ type: "created", providerMessageId: message.id, providerThreadId: message.conversationId ?? message.id });
      }
      nextLink = page["@odata.nextLink"] ?? null;
    }

    const nextCursor = await this.drainDeltaToCheckpoint(externalAccountId);
    return { changes: changes.slice(0, env.MICROSOFT365_INITIAL_SYNC_MAX_MESSAGES), nextCursor };
  }

  private async drainDeltaToCheckpoint(externalAccountId: string): Promise<string> {
    let path: string = `${graphUserPath(externalAccountId)}/mailFolders('Inbox')/messages/delta`;
    let query: Record<string, string> | undefined = { $select: GRAPH_CHANGE_SELECT };
    for (;;) {
      const page: GraphDeltaPage = await this.graph.request("GET", path, query ? { query } : undefined);
      query = undefined;
      if (page["@odata.deltaLink"]) return page["@odata.deltaLink"];
      if (!page["@odata.nextLink"]) {
        throw new GraphApiError(500, undefined, "Graph delta query senza @odata.deltaLink né @odata.nextLink: risposta inattesa.");
      }
      path = page["@odata.nextLink"];
    }
  }

  private async followDelta(cursor: string): Promise<{ changes: MailChange[]; nextCursor: string | null }> {
    const changes: MailChange[] = [];
    let path = cursor;
    for (;;) {
      const page: GraphDeltaPage = await this.graph.request("GET", path);
      for (const message of page.value) {
        changes.push({ type: "updated", providerMessageId: message.id, providerThreadId: message.conversationId ?? message.id });
      }
      if (page["@odata.deltaLink"]) return { changes, nextCursor: page["@odata.deltaLink"] };
      if (!page["@odata.nextLink"]) {
        throw new GraphApiError(500, undefined, "Graph delta query senza @odata.deltaLink né @odata.nextLink: risposta inattesa.");
      }
      path = page["@odata.nextLink"];
    }
  }

  /** Nessun effetto lato Graph: l'idempotenza vive nella coda job (SPEC.md §3), non nel
   * provider, per questo canale — mantenuto per soddisfare l'interfaccia. */
  async markProcessingResult(
    _externalAccountId: string,
    _providerMessageId: string,
    _result: { ok: boolean; error?: string },
  ): Promise<void> {}

  async healthCheck(externalAccountId: string): Promise<HealthStatus> {
    try {
      const subscription = await this.findSubscriptionForMailbox(externalAccountId);
      if (!subscription) {
        return { status: "degraded", message: "Nessuna subscription attiva trovata per questa mailbox.", checkedAt: new Date() };
      }
      const marginMs = env.MICROSOFT365_SUBSCRIPTION_RENEWAL_MARGIN_HOURS * 60 * 60 * 1000;
      if (new Date(subscription.expirationDateTime).getTime() - Date.now() < marginMs) {
        return { status: "degraded", message: "Subscription in scadenza: in attesa di rinnovo.", checkedAt: new Date() };
      }
      return { status: "ok", checkedAt: new Date() };
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : String(error),
        checkedAt: new Date(),
      };
    }
  }
}
