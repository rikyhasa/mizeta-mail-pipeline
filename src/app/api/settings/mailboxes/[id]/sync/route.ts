import { prisma } from "@/lib/db/prisma";
import { withPermission } from "@/lib/auth/route-helpers";
import { env } from "@/lib/config/env";
import { ingestMailboxChanges } from "@/lib/mail/ingest-mailbox";

/**
 * "Sincronizza ora" (SPEC.md §16): ingestione reale tramite l'orchestratore condiviso
 * (src/lib/mail/ingest-mailbox.ts) — crea davvero le righe EmailMessage/Attachment mancanti,
 * aggiorna il cursore di sync e accoda la pipeline per ogni messaggio nuovo. Disponibile per
 * `mock` e `microsoft365`; `pec_imap` resta uno scheletro non funzionante (SPEC.md §3).
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return withPermission("settings:manage", async () => {
    const { id } = await context.params;
    const mailbox = await prisma.mailboxConnection.findUnique({ where: { id } });
    if (!mailbox) return Response.json({ error: "Mailbox non trovata" }, { status: 404 });

    if (env.EMAIL_PROVIDER === "pec_imap") {
      return Response.json({ error: "pec_imap resta uno scheletro documentato in questa fase: sincronizzazione non disponibile." }, { status: 501 });
    }

    const { newMessageIds } = await ingestMailboxChanges(id);
    const updated = await prisma.mailboxConnection.findUniqueOrThrow({ where: { id } });
    return Response.json({ mailbox: updated, newMessages: newMessageIds.length });
  });
}
