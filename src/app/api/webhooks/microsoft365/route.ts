import { prisma } from "@/lib/db/prisma";
import { enqueueJob } from "@/lib/jobs/queue";
import { ingestMailboxChangesIdempotencyKey } from "@/lib/jobs/types";
import { graphChangeNotificationEnvelopeSchema } from "@/lib/adapters/mail/microsoft365/webhook-schemas";
import { logger } from "@/lib/observability/logger";

/**
 * Ricevitore delle change notification Microsoft Graph (SPEC.md §3). CLAUDE.md invariante 1
 * esteso a qualunque input esterno, non solo al corpo email: questo payload non viene MAI usato
 * per decidere cosa leggere, solo che una mailbox va risincronizzata — l'INGEST_MAILBOX_CHANGES
 * accodato rilegge sempre tramite il cursore già persistito su MailboxConnection, mai tramite
 * campi della notifica. Una notifica con `clientState` non corrispondente (o per una
 * subscription sconosciuta) viene scartata silenziosamente: mai processata, mai un fetch
 * innescato da dati non verificati. Risposta sempre rapida (200/202), zero lavoro
 * pipeline/LLM inline.
 */
export async function POST(request: Request) {
  const validationToken = new URL(request.url).searchParams.get("validationToken");
  if (validationToken !== null) {
    return new Response(validationToken, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const parsed = graphChangeNotificationEnvelopeSchema.safeParse(body);
  if (!parsed.success) {
    logger.warn("webhook.microsoft365.invalid-payload", { issueCount: parsed.error.issues.length });
    return new Response(null, { status: 400 });
  }

  for (const notification of parsed.data.value) {
    const mailbox = await prisma.mailboxConnection.findFirst({
      where: { subscriptionId: notification.subscriptionId },
    });
    if (!mailbox) {
      logger.warn("webhook.microsoft365.unknown-subscription", { subscriptionId: notification.subscriptionId });
      continue;
    }
    if (!mailbox.webhookClientState || mailbox.webhookClientState !== notification.clientState) {
      logger.warn("webhook.microsoft365.client-state-mismatch", { mailboxConnectionId: mailbox.id });
      continue;
    }

    await enqueueJob({
      type: "INGEST_MAILBOX_CHANGES",
      payload: { mailboxConnectionId: mailbox.id },
      idempotencyKey: ingestMailboxChangesIdempotencyKey(mailbox.id),
    });
  }

  return new Response(null, { status: 202 });
}

/** Graph invia l'handshake di validazione come GET in alcuni scenari (rinnovo) oltre al POST
 * iniziale in fase di creazione della subscription: stessa risposta in entrambi i casi. */
export async function GET(request: Request) {
  const validationToken = new URL(request.url).searchParams.get("validationToken");
  if (validationToken !== null) {
    return new Response(validationToken, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response(null, { status: 405 });
}
