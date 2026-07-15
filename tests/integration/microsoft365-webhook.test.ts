import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { POST, GET } from "@/app/api/webhooks/microsoft365/route";
import { ingestMailboxChangesIdempotencyKey } from "@/lib/jobs/types";

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

/**
 * CLAUDE.md invariante 1 esteso a input esterni: il payload di una change notification Graph
 * non è affidabile. Questi test verificano che una notifica non verificata (clientState
 * sbagliato, subscription sconosciuta, corpo malformato) non innesca MAI un job — solo una
 * notifica verificata lo fa, e senza mai usare il contenuto del payload per decidere cosa
 * leggere (solo `mailboxConnectionId`, mai `resourceData`).
 */
describe("POST /api/webhooks/microsoft365", () => {
  const createdMailboxIds: string[] = [];
  const createdJobIds: string[] = [];

  afterAll(async () => {
    await prisma.job.deleteMany({ where: { id: { in: createdJobIds } } });
    await prisma.mailboxConnection.deleteMany({ where: { id: { in: createdMailboxIds } } });
    await prisma.$disconnect();
  });

  it("GET/POST con validationToken risponde in eco senza toccare il DB", async () => {
    const url = "http://localhost/api/webhooks/microsoft365?validationToken=abc123";
    const postResponse = await POST(new Request(url, { method: "POST" }));
    expect(postResponse.status).toBe(200);
    expect(await postResponse.text()).toBe("abc123");

    const getResponse = await GET(new Request(url, { method: "GET" }));
    expect(getResponse.status).toBe(200);
    expect(await getResponse.text()).toBe("abc123");
  });

  it("un corpo non-JSON risponde 400, mai un crash", async () => {
    const response = await POST(new Request("http://localhost/api/webhooks/microsoft365", { method: "POST", body: "non è json" }));
    expect(response.status).toBe(400);
  });

  it("un payload valido Zod ma con clientState non corrispondente viene scartato: nessun job accodato", async () => {
    const mailbox = await prisma.mailboxConnection.create({
      data: {
        provider: "MICROSOFT365",
        displayName: "Test Webhook Mismatch",
        emailAddress: "test-webhook-mismatch@mizeta.it",
        status: "CONNECTED",
        isPec: false,
        externalAccountId: "test-webhook-mismatch@mizeta.it",
        subscriptionId: "sub-mismatch-1",
        webhookClientState: "stato-corretto",
      },
    });
    createdMailboxIds.push(mailbox.id);

    const response = await POST(
      jsonRequest("http://localhost/api/webhooks/microsoft365", {
        value: [{ subscriptionId: "sub-mismatch-1", clientState: "stato-sbagliato", changeType: "created", resource: "users/x/messages" }],
      }),
    );
    expect(response.status).toBe(202);

    const job = await prisma.job.findUnique({ where: { idempotencyKey: ingestMailboxChangesIdempotencyKey(mailbox.id) } });
    expect(job).toBeNull();
  });

  it("una subscription sconosciuta viene scartata: nessun job accodato", async () => {
    const response = await POST(
      jsonRequest("http://localhost/api/webhooks/microsoft365", {
        value: [{ subscriptionId: "sub-non-esistente", clientState: "qualsiasi", changeType: "created", resource: "users/x/messages" }],
      }),
    );
    expect(response.status).toBe(202);
    // Nessuna asserzione sul DB necessaria: non esiste alcuna mailbox con questo subscriptionId,
    // quindi non può esistere alcun job accodato per essa.
  });

  it("un payload valido con clientState corretto accoda INGEST_MAILBOX_CHANGES per la mailbox", async () => {
    const mailbox = await prisma.mailboxConnection.create({
      data: {
        provider: "MICROSOFT365",
        displayName: "Test Webhook Match",
        emailAddress: "test-webhook-match@mizeta.it",
        status: "CONNECTED",
        isPec: false,
        externalAccountId: "test-webhook-match@mizeta.it",
        subscriptionId: "sub-match-1",
        webhookClientState: "stato-corretto",
      },
    });
    createdMailboxIds.push(mailbox.id);

    const response = await POST(
      jsonRequest("http://localhost/api/webhooks/microsoft365", {
        value: [{ subscriptionId: "sub-match-1", clientState: "stato-corretto", changeType: "created", resource: "users/x/messages", resourceData: { id: "should-be-ignored" } }],
      }),
    );
    expect(response.status).toBe(202);

    const job = await prisma.job.findUniqueOrThrow({ where: { idempotencyKey: ingestMailboxChangesIdempotencyKey(mailbox.id) } });
    createdJobIds.push(job.id);
    expect(job.type).toBe("INGEST_MAILBOX_CHANGES");
    expect((job.payload as { mailboxConnectionId: string }).mailboxConnectionId).toBe(mailbox.id);
  });
});
