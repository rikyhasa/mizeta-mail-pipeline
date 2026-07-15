import { describe, expect, it, vi } from "vitest";
import { GraphApiError, GraphHttpClient } from "@/lib/adapters/mail/microsoft365/graph-http-client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("GraphHttpClient — nessuna credenziale reale, tutto mockato via fetchImpl", () => {
  it("acquisisce un token e lo riusa finché non è vicino alla scadenza", async () => {
    let tokenCalls = 0;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/oauth2/v2.0/token")) {
        tokenCalls += 1;
        return jsonResponse({ access_token: "token-1", expires_in: 3600 });
      }
      return jsonResponse({ value: [] });
    });

    const client = new GraphHttpClient({
      tenantId: "test-tenant",
      clientId: "test-client",
      clientSecret: "test-secret",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await client.request("GET", "/subscriptions");
    await client.request("GET", "/subscriptions");

    expect(tokenCalls).toBe(1);
  });

  it("include il bearer token e il metodo corretti nella richiesta Graph", async () => {
    let capturedAuth: string | null = null;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/oauth2/v2.0/token")) return jsonResponse({ access_token: "abc123", expires_in: 3600 });
      capturedAuth = (init?.headers as Record<string, string>)?.Authorization ?? null;
      return jsonResponse({ id: "sub-1" });
    });

    const client = new GraphHttpClient({
      tenantId: "t",
      clientId: "c",
      clientSecret: "s",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await client.request("POST", "/subscriptions", { body: { foo: "bar" } });
    expect(capturedAuth).toBe("Bearer abc123");
  });

  it("lancia GraphApiError con status e messaggio su risposta non-ok", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/oauth2/v2.0/token")) return jsonResponse({ access_token: "abc", expires_in: 3600 });
      return new Response(JSON.stringify({ error: { code: "NotFound", message: "boom" } }), { status: 404 });
    });

    const client = new GraphHttpClient({
      tenantId: "t",
      clientId: "c",
      clientSecret: "s",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.request("GET", "/subscriptions/xyz")).rejects.toThrow(GraphApiError);
  });

  it("lancia GraphApiError se l'autenticazione fallisce", async () => {
    const fetchImpl = vi.fn(async () => new Response("unauthorized", { status: 401 }));
    const client = new GraphHttpClient({
      tenantId: "t",
      clientId: "c",
      clientSecret: "wrong",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(client.request("GET", "/subscriptions")).rejects.toThrow(GraphApiError);
  });
});
