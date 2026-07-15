import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withPermission } from "@/lib/auth/route-helpers";
import { writeAuditLog } from "@/lib/pipeline/audit";
import { env } from "@/lib/config/env";
import { getMailProvider } from "@/lib/adapters/mail/mail-provider-factory";
import { Microsoft365MailProviderAdapter } from "@/lib/adapters/mail/microsoft365/microsoft365-provider";
import type { MailProviderType } from "@/generated/prisma/enums";

const postSchema = z.object({
  emailAddress: z.string().email(),
  displayName: z.string().min(1),
});

const PROVIDER_BY_ENV: Record<typeof env.EMAIL_PROVIDER, MailProviderType> = {
  mock: "MOCK",
  microsoft365: "MICROSOFT365",
  pec_imap: "PEC_IMAP",
};

/**
 * Collega una mailbox reale (SPEC.md §16). Il provider è sempre quello attivo globalmente
 * (`env.EMAIL_PROVIDER`), non scelto dall'utente — l'app istanzia un solo `MailProviderAdapter`
 * alla volta (`getMailProvider()`). Per `pec_imap` (scheletro non funzionante, SPEC.md §3) la
 * riga viene creata comunque, in stato `PENDING`, SENZA invocare `connectAccount` (che
 * lancerebbe): Impostazioni deve poter mostrare la mailbox PEC configurata senza far fallire
 * la richiesta.
 */
export async function POST(request: Request) {
  return withPermission("settings:manage", async (user) => {
    const parsed = postSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json({ error: "Dati mailbox non validi" }, { status: 400 });
    }

    const provider = PROVIDER_BY_ENV[env.EMAIL_PROVIDER];
    const isPec = env.EMAIL_PROVIDER === "pec_imap";
    const { emailAddress, displayName } = parsed.data;

    const existing = await prisma.mailboxConnection.findUnique({
      where: { provider_emailAddress: { provider, emailAddress } },
    });
    if (existing) {
      return Response.json({ error: "Mailbox già collegata per questo provider" }, { status: 409 });
    }

    if (env.EMAIL_PROVIDER === "pec_imap") {
      const created = await prisma.$transaction(async (tx) => {
        const mailbox = await tx.mailboxConnection.create({
          data: { provider, displayName, emailAddress, status: "PENDING", isPec, createdById: user.id },
        });
        await writeAuditLog(tx, {
          action: "ADMIN_ACTION",
          entityType: "MailboxConnection",
          entityId: mailbox.id,
          actorId: user.id,
          metadata: { action: "mailbox_created", provider, note: "pec_imap: scheletro, nessuna connessione reale" },
        });
        return mailbox;
      });
      return Response.json({ mailbox: created }, { status: 201 });
    }

    const adapter = getMailProvider();
    const { externalAccountId } = await adapter.connectAccount({ emailAddress, displayName, isPec });

    const subscriptionFields: { subscriptionId?: string; subscriptionExpiresAt?: Date; webhookClientState?: string } = {};
    if (adapter instanceof Microsoft365MailProviderAdapter) {
      const subscription = adapter.getLastCreatedSubscription();
      if (subscription) {
        subscriptionFields.subscriptionId = subscription.subscriptionId;
        subscriptionFields.subscriptionExpiresAt = subscription.expiresAt;
        subscriptionFields.webhookClientState = subscription.clientState;
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const mailbox = await tx.mailboxConnection.create({
        data: {
          provider,
          displayName,
          emailAddress,
          status: "CONNECTED",
          isPec,
          externalAccountId,
          createdById: user.id,
          ...subscriptionFields,
        },
      });
      await writeAuditLog(tx, {
        action: "ADMIN_ACTION",
        entityType: "MailboxConnection",
        entityId: mailbox.id,
        actorId: user.id,
        metadata: { action: "mailbox_connected", provider },
      });
      return mailbox;
    });

    return Response.json({ mailbox: created }, { status: 201 });
  });
}
