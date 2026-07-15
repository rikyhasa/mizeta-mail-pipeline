import { env } from "@/lib/config/env";
import type { MailProviderAdapter } from "@/lib/adapters/mail/types";
import { MockMailProviderAdapter } from "@/lib/adapters/mail/mock-mail-provider";
import { GraphHttpClient } from "@/lib/adapters/mail/microsoft365/graph-http-client";
import { Microsoft365MailProviderAdapter } from "@/lib/adapters/mail/microsoft365/microsoft365-provider";
import { PecImapProviderAdapter } from "@/lib/adapters/mail/pec-imap/pec-imap-provider";

/**
 * Factory basata su `env.EMAIL_PROVIDER` (stesso pattern di `llm-provider-factory.ts`). Fallisce
 * sempre in modo esplicito e comprensibile: `microsoft365` richiede le credenziali app Graph;
 * `pec_imap` istanzia comunque uno scheletro (non lancia in questa fase, SPEC.md §3), perché la
 * pagina Impostazioni deve poter mostrare la riga di una mailbox PEC senza fallire.
 */
export function getMailProvider(): MailProviderAdapter {
  switch (env.EMAIL_PROVIDER) {
    case "mock":
      return new MockMailProviderAdapter();
    case "microsoft365": {
      if (!env.MICROSOFT365_CLIENT_ID || !env.MICROSOFT365_CLIENT_SECRET || !env.MICROSOFT365_TENANT_ID) {
        throw new Error(
          "EMAIL_PROVIDER=microsoft365 ma MICROSOFT365_CLIENT_ID/CLIENT_SECRET/TENANT_ID non sono impostate nell'ambiente.",
        );
      }
      const graph = new GraphHttpClient({
        tenantId: env.MICROSOFT365_TENANT_ID,
        clientId: env.MICROSOFT365_CLIENT_ID,
        clientSecret: env.MICROSOFT365_CLIENT_SECRET,
      });
      return new Microsoft365MailProviderAdapter(graph);
    }
    case "pec_imap":
      return new PecImapProviderAdapter();
    default: {
      const exhaustiveCheck: never = env.EMAIL_PROVIDER;
      throw new Error(`EMAIL_PROVIDER non riconosciuto: ${String(exhaustiveCheck)}`);
    }
  }
}

/** Istanza pigra e memorizzata, per riuso nell'orchestratore senza ricostruire il client a ogni chiamata. */
let cachedProvider: MailProviderAdapter | null = null;

export function getCachedMailProvider(): MailProviderAdapter {
  if (!cachedProvider) cachedProvider = getMailProvider();
  return cachedProvider;
}

/** Usata dai test per forzare la ricostruzione del provider dopo un cambio env. */
export function resetCachedMailProvider(): void {
  cachedProvider = null;
}
