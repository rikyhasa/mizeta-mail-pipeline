import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieStore.has(name) ? { name, value: cookieStore.get(name)! } : undefined),
    set: (name: string, value: string) => {
      cookieStore.set(name, value);
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
    has: (name: string) => cookieStore.has(name),
  }),
}));

import { prisma } from "@/lib/db/prisma";
import { createSession } from "@/lib/auth/session";
import { POST as postMailbox } from "@/app/api/settings/mailboxes/route";

function request(body: unknown): Request {
  return new Request("http://localhost/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe("POST /api/settings/mailboxes (EMAIL_PROVIDER=mock in ambiente di test)", () => {
  const createdMailboxIds: string[] = [];

  beforeEach(() => {
    cookieStore.clear();
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { entityType: "MailboxConnection", entityId: { in: createdMailboxIds } } });
    await prisma.mailboxConnection.deleteMany({ where: { id: { in: createdMailboxIds } } });
    await prisma.$disconnect();
  });

  it("collega una mailbox mock e scrive l'audit ADMIN_ACTION", async () => {
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    await createSession(admin.id);

    const emailAddress = `test-connect-${Date.now()}@mizeta.it`;
    const response = await postMailbox(request({ emailAddress, displayName: "Test Collegamento" }));
    expect(response.status).toBe(201);
    const { mailbox } = await response.json();
    createdMailboxIds.push(mailbox.id);
    expect(mailbox.status).toBe("CONNECTED");
    expect(mailbox.provider).toBe("MOCK");

    const audit = await prisma.auditLog.findFirst({ where: { entityType: "MailboxConnection", entityId: mailbox.id } });
    expect(audit).toBeTruthy();
  });

  it("rifiuta un utente non-ADMIN", async () => {
    const operations = await prisma.user.findFirstOrThrow({ where: { role: "OPERATIONS" } });
    await createSession(operations.id);
    const response = await postMailbox(request({ emailAddress: `nope-${Date.now()}@mizeta.it`, displayName: "Nope" }));
    expect(response.status).toBe(403);
  });

  it("rifiuta una mailbox duplicata per lo stesso provider", async () => {
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    await createSession(admin.id);
    const emailAddress = `test-duplicate-${Date.now()}@mizeta.it`;
    const first = await postMailbox(request({ emailAddress, displayName: "Primo" }));
    const { mailbox } = await first.json();
    createdMailboxIds.push(mailbox.id);

    const second = await postMailbox(request({ emailAddress, displayName: "Secondo" }));
    expect(second.status).toBe(409);
  });
});
