import { prisma } from "@/lib/db/prisma";
import { withPermission } from "@/lib/auth/route-helpers";
import { env } from "@/lib/config/env";
import { MockMailProviderAdapter } from "@/lib/adapters/mail/mock-mail-provider";

/** "Test connessione" (SPEC.md §16): funzionante solo in modalità mock — gli adapter reali sono Fase 4. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return withPermission("settings:manage", async () => {
    const { id } = await context.params;
    const mailbox = await prisma.mailboxConnection.findUnique({ where: { id } });
    if (!mailbox) return Response.json({ error: "Mailbox non trovata" }, { status: 404 });

    if (env.EMAIL_PROVIDER !== "mock") {
      return Response.json({ error: "Test connessione non disponibile per questo provider in questa fase (Fase 4)." }, { status: 501 });
    }

    const adapter = new MockMailProviderAdapter();
    const health = await adapter.healthCheck(mailbox.isPec ? "pec" : "info");
    const updated = await prisma.mailboxConnection.update({
      where: { id },
      data: { lastHealthCheckAt: health.checkedAt, lastHealthStatus: health.status },
    });
    return Response.json({ mailbox: updated });
  });
}
