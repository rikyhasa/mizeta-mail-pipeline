import { describe, expect, it, vi } from "vitest";
import type { GraphClient, GraphHttpMethod, GraphRequestOptions } from "@/lib/adapters/mail/microsoft365/graph-http-client";
import { Microsoft365MailProviderAdapter } from "@/lib/adapters/mail/microsoft365/microsoft365-provider";

class FakeGraphClient implements GraphClient {
  handler: (method: GraphHttpMethod, path: string, options?: GraphRequestOptions) => unknown;

  constructor(handler: (method: GraphHttpMethod, path: string, options?: GraphRequestOptions) => unknown) {
    this.handler = handler;
  }

  async request<T>(method: GraphHttpMethod, path: string, options?: GraphRequestOptions): Promise<T> {
    return this.handler(method, path, options) as T;
  }
}

describe("Microsoft365MailProviderAdapter — testato con un GraphClient finto, nessuna credenziale reale", () => {
  it("connectAccount crea una subscription e la espone via getLastCreatedSubscription", async () => {
    const requests: { method: GraphHttpMethod; path: string; body?: unknown }[] = [];
    const client = new FakeGraphClient((method, path, options) => {
      requests.push({ method, path, body: options?.body });
      return { id: "sub-123", resource: "users/info@mizeta.it/mailFolders('Inbox')/messages", expirationDateTime: "2026-01-20T00:00:00Z", clientState: "state-abc" };
    });

    const adapter = new Microsoft365MailProviderAdapter(client, "https://app.local/api/webhooks/microsoft365");
    const result = await adapter.connectAccount({ emailAddress: "info@mizeta.it", displayName: "Info" });

    expect(result.externalAccountId).toBe("info@mizeta.it");
    expect(requests[0].method).toBe("POST");
    expect(requests[0].path).toBe("/subscriptions");
    expect((requests[0].body as { notificationUrl: string }).notificationUrl).toBe("https://app.local/api/webhooks/microsoft365");

    const subscription = adapter.getLastCreatedSubscription();
    expect(subscription?.subscriptionId).toBe("sub-123");
    expect(subscription?.clientState).toBe("state-abc");
  });

  it("listChanges con cursore nullo fa il sync iniziale limitato e ritorna un deltaLink come nextCursor", async () => {
    const client = new FakeGraphClient((_method, path) => {
      if (path.includes("/messages/delta")) {
        return { value: [], "@odata.deltaLink": "https://graph.microsoft.com/v1.0/delta-checkpoint" };
      }
      if (path.includes("/mailFolders('Inbox')/messages")) {
        return { value: [{ id: "m1", conversationId: "c1" }, { id: "m2", conversationId: "c2" }] };
      }
      throw new Error(`unexpected path ${path}`);
    });

    const adapter = new Microsoft365MailProviderAdapter(client);
    const { changes, nextCursor } = await adapter.listChanges("info@mizeta.it", null);

    expect(changes).toEqual([
      { type: "created", providerMessageId: "m1", providerThreadId: "c1" },
      { type: "created", providerMessageId: "m2", providerThreadId: "c2" },
    ]);
    expect(nextCursor).toBe("https://graph.microsoft.com/v1.0/delta-checkpoint");
  });

  it("listChanges con cursore segue @odata.nextLink fino a un nuovo deltaLink", async () => {
    let call = 0;
    const client = new FakeGraphClient((_method, path) => {
      call += 1;
      if (call === 1) {
        expect(path).toBe("https://graph.microsoft.com/v1.0/delta-cursor-1");
        return { value: [{ id: "m3", conversationId: "c3" }], "@odata.nextLink": "https://graph.microsoft.com/v1.0/delta-page-2" };
      }
      return { value: [{ id: "m4", conversationId: "c4" }], "@odata.deltaLink": "https://graph.microsoft.com/v1.0/delta-cursor-2" };
    });

    const adapter = new Microsoft365MailProviderAdapter(client);
    const { changes, nextCursor } = await adapter.listChanges("info@mizeta.it", "https://graph.microsoft.com/v1.0/delta-cursor-1");

    expect(changes).toEqual([
      { type: "updated", providerMessageId: "m3", providerThreadId: "c3" },
      { type: "updated", providerMessageId: "m4", providerThreadId: "c4" },
    ]);
    expect(nextCursor).toBe("https://graph.microsoft.com/v1.0/delta-cursor-2");
  });

  it("healthCheck non lancia mai: degrada se non trova la subscription", async () => {
    const client = new FakeGraphClient(() => ({ value: [] }));
    const adapter = new Microsoft365MailProviderAdapter(client);
    const health = await adapter.healthCheck("info@mizeta.it");
    expect(health.status).toBe("degraded");
  });

  it("healthCheck degrada se la subscription è vicina a scadenza", async () => {
    const soon = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h, sotto il margine di default (24h)
    const client = new FakeGraphClient(() => ({
      value: [{ id: "sub-1", resource: "users/info@mizeta.it/mailFolders('Inbox')/messages", expirationDateTime: soon, clientState: "x" }],
    }));
    const adapter = new Microsoft365MailProviderAdapter(client);
    const health = await adapter.healthCheck("info@mizeta.it");
    expect(health.status).toBe("degraded");
  });

  it("healthCheck ritorna error se la chiamata Graph fallisce, mai un throw", async () => {
    const client = new FakeGraphClient(() => {
      throw new Error("rete non disponibile");
    });
    const adapter = new Microsoft365MailProviderAdapter(client);
    const health = await adapter.healthCheck("info@mizeta.it");
    expect(health.status).toBe("error");
  });

  it("renewSubscription trova la subscription per resource path e la rinnova", async () => {
    const calls: { method: GraphHttpMethod; path: string }[] = [];
    const client = new FakeGraphClient((method, path) => {
      calls.push({ method, path });
      if (method === "GET" && path === "/subscriptions") {
        return { value: [{ id: "sub-9", resource: "users/info@mizeta.it/mailFolders('Inbox')/messages", expirationDateTime: "2026-01-01T00:00:00Z", clientState: "x" }] };
      }
      if (method === "PATCH") {
        return { id: "sub-9", expirationDateTime: "2026-02-01T00:00:00Z" };
      }
      throw new Error("unexpected call");
    });
    const adapter = new Microsoft365MailProviderAdapter(client);
    const { expiresAt } = await adapter.renewSubscription("info@mizeta.it");
    expect(expiresAt.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(calls.some((c) => c.method === "PATCH" && c.path === "/subscriptions/sub-9")).toBe(true);
  });

  it("renewSubscription lancia un errore esplicito se non trova alcuna subscription", async () => {
    const client = new FakeGraphClient(() => ({ value: [] }));
    const adapter = new Microsoft365MailProviderAdapter(client);
    await expect(adapter.renewSubscription("info@mizeta.it")).rejects.toThrow();
  });

  it("markProcessingResult non fa alcuna chiamata Graph (idempotenza vive nella coda job)", async () => {
    const handler = vi.fn();
    const client = new FakeGraphClient(handler);
    const adapter = new Microsoft365MailProviderAdapter(client);
    await adapter.markProcessingResult("info@mizeta.it", "m1", { ok: true });
    expect(handler).not.toHaveBeenCalled();
  });
});
