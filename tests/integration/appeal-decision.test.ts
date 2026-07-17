import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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

const { prisma } = await import("@/lib/db/prisma");
const { createSession } = await import("@/lib/auth/session");
const { PATCH: patchAppealDecision } = await import("@/app/api/cases/[id]/appeal-decision/route");

function jsonRequest(body: unknown) {
  return new Request("http://localhost/test", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/cases/[id]/appeal-decision (docs/SPEC.md §10bis)", () => {
  let caseId: string;
  let adminId: string;
  let readOnlyId: string;

  beforeAll(async () => {
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    const readOnly = await prisma.user.findFirstOrThrow({ where: { role: "READ_ONLY" } });
    adminId = admin.id;
    readOnlyId = readOnly.id;

    const created = await prisma.case.create({
      data: {
        reference: `TEST-APPEAL-${Date.now()}`,
        title: "Multa di test per indicatore ricorso",
        category: "FINE_OR_PENALTY",
        status: "NEW",
        priority: "NORMAL",
      },
    });
    caseId = created.id;
  });

  beforeEach(() => {
    cookieStore.clear();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects a READ_ONLY user with 403", async () => {
    await createSession(readOnlyId);
    const response = await patchAppealDecision(jsonRequest({ decision: "NO_APPEAL" }), { params: Promise.resolve({ id: caseId }) });
    expect(response.status).toBe(403);
  });

  it("rejects a decision value outside the allowlist", async () => {
    await createSession(adminId);
    const response = await patchAppealDecision(jsonRequest({ decision: "MAYBE" }), { params: Promise.resolve({ id: caseId }) });
    expect(response.status).toBe(400);
  });

  it("returns 404 for a non-existent case", async () => {
    await createSession(adminId);
    const response = await patchAppealDecision(jsonRequest({ decision: "NO_APPEAL" }), { params: Promise.resolve({ id: "does-not-exist" }) });
    expect(response.status).toBe(404);
  });

  it("records the decision, stamps decidedById/decidedAt, and writes APPEAL_DECISION_RECORDED audit", async () => {
    await createSession(adminId);
    const response = await patchAppealDecision(jsonRequest({ decision: "GDP_FILED", note: "Concordato con il cliente" }), {
      params: Promise.resolve({ id: caseId }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.appealDecision.decision).toBe("GDP_FILED");
    expect(body.appealDecision.decidedById).toBe(adminId);
    expect(body.appealDecision.decidedAt).toBeTruthy();
    expect(body.appealDecision.note).toBe("Concordato con il cliente");

    const audit = await prisma.auditLog.findFirst({
      where: { action: "APPEAL_DECISION_RECORDED", caseId },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).toBeTruthy();
    expect(audit?.actorId).toBe(adminId);
    expect((audit?.metadata as { to: string } | null)?.to).toBe("GDP_FILED");
  });

  it("a second call updates the same decision (1:1 with the case) and audits the transition", async () => {
    await createSession(adminId);
    const response = await patchAppealDecision(jsonRequest({ decision: "NO_APPEAL" }), { params: Promise.resolve({ id: caseId }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.appealDecision.decision).toBe("NO_APPEAL");

    const decisions = await prisma.appealDecision.findMany({ where: { caseId } });
    expect(decisions).toHaveLength(1);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "APPEAL_DECISION_RECORDED", caseId },
      orderBy: { createdAt: "desc" },
    });
    expect((audit?.metadata as { from: string; to: string } | null)?.from).toBe("GDP_FILED");
    expect((audit?.metadata as { from: string; to: string } | null)?.to).toBe("NO_APPEAL");
  });
});
