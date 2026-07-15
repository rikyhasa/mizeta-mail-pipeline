/**
 * Client HTTP sottile sopra `fetch` nativo per Microsoft Graph — deliberatamente SENZA
 * `@azure/msal-node`/`@microsoft/microsoft-graph-client`: la superficie richiesta è piccola e
 * puramente REST (token OAuth2 client-credentials, subscriptions, delta query, messages,
 * attachments), ed è più semplice da testare iniettando `fetchImpl` che mockare gli interni di
 * un SDK. Nessuna credenziale reale è mai richiesta dai test: `fetchImpl` è sempre sostituibile.
 */

export type GraphHttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export interface GraphRequestOptions {
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  /** false per risposte senza corpo JSON (es. DELETE, 204 No Content). */
  parseJson?: boolean;
}

export class GraphApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = "GraphApiError";
  }
}

export interface GraphClient {
  request<T>(method: GraphHttpMethod, path: string, options?: GraphRequestOptions): Promise<T>;
}

export interface GraphHttpClientOptions {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  /** Iniettabile per i test — default `fetch` globale, mai chiamato con credenziali reali nei test. */
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  tokenUrl?: string;
}

const DEFAULT_GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";

export class GraphHttpClient implements GraphClient {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly tokenUrl: string;
  private cachedToken: { accessToken: string; expiresAt: number } | null = null;

  constructor(private readonly options: GraphHttpClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl ?? DEFAULT_GRAPH_BASE_URL;
    this.tokenUrl = options.tokenUrl ?? `https://login.microsoftonline.com/${options.tenantId}/oauth2/v2.0/token`;
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt - 60_000 > now) {
      return this.cachedToken.accessToken;
    }

    const body = new URLSearchParams({
      client_id: this.options.clientId,
      client_secret: this.options.clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    });
    const response = await this.fetchImpl(this.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new GraphApiError(response.status, undefined, `Autenticazione Microsoft365 fallita (${response.status}): ${text}`);
    }
    const data = (await response.json()) as { access_token: string; expires_in: number };
    this.cachedToken = { accessToken: data.access_token, expiresAt: now + data.expires_in * 1000 };
    return this.cachedToken.accessToken;
  }

  async request<T>(method: GraphHttpMethod, path: string, options: GraphRequestOptions = {}): Promise<T> {
    const token = await this.getAccessToken();
    const url = new URL(path.startsWith("http") ? path : `${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const response = await this.fetchImpl(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      let code: string | undefined;
      try {
        code = (JSON.parse(text) as { error?: { code?: string } })?.error?.code;
      } catch {
        // Corpo non JSON: nessun codice errore Graph disponibile, si usa solo lo status.
      }
      throw new GraphApiError(response.status, code, `Graph API error ${response.status} su ${method} ${path}: ${text}`);
    }

    if (options.parseJson === false || response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }
}
