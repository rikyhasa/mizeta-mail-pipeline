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
const { POST: postDraft } = await import("@/app/api/cases/[id]/drafts/route");
const { PATCH: patchDraft } = await import("@/app/api/cases/[id]/drafts/[draftId]/route");

function request(method: string, body?: unknown) {
  return new Request("http://localhost/test", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("Draft generation and approval (SPEC.md §11, invariant 3: mai inviate)", () => {
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
        reference: `TEST-DRAFT-${Date.now()}`,
        title: "Credito di test per bozza",
        category: "CUSTOMER_RECEIVABLE",
        status: "NEW",
        priority: "NORMAL",
        summary: "Sintesi di test",
      },
    });
    caseId = created.id;
    await prisma.caseField.createMany({
      data: [
        { caseId, fieldKey: "customer_name", value: "Cliente Prova Srl" },
        { caseId, fieldKey: "invoice_number", value: "FAT-TEST-001" },
        { caseId, fieldKey: "amount", value: "500" },
        { caseId, fieldKey: "due_date", value: "2026-08-01T00:00:00.000Z" },
      ],
    });
  });

  beforeEach(() => {
    cookieStore.clear();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects a READ_ONLY user with 403", async () => {
    await createSession(readOnlyId);
    const response = await postDraft(request("POST"), { params: Promise.resolve({ id: caseId }) });
    expect(response.status).toBe(403);
  });

  it("creates a draft in PENDING_APPROVAL, never approved or sent by default", async () => {
    await createSession(adminId);
    const response = await postDraft(request("POST"), { params: Promise.resolve({ id: caseId }) });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.draft.status).toBe("PENDING_APPROVAL");
    expect(body.draft).not.toHaveProperty("sentAt");
    expect(body.draft.approvedAt).toBeNull();

    const audit = await prisma.auditLog.findFirst({ where: { action: "DRAFT_GENERATED", caseId }, orderBy: { createdAt: "desc" } });
    expect(audit).toBeTruthy();
  });

  it("requires explicit human approval: approve sets APPROVED and records who/when", async () => {
    await createSession(adminId);
    const draft = await prisma.emailDraft.findFirstOrThrow({ where: { caseId }, orderBy: { createdAt: "desc" } });

    const response = await patchDraft(request("PATCH", { action: "approve" }), { params: Promise.resolve({ id: caseId, draftId: draft.id }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.draft.status).toBe("APPROVED");
    expect(body.draft.approvedById).toBe(adminId);
    expect(body.draft.approvedAt).toBeTruthy();

    const audit = await prisma.auditLog.findFirst({ where: { action: "DRAFT_APPROVED", caseId }, orderBy: { createdAt: "desc" } });
    expect(audit).toBeTruthy();
  });

  it("rejects approving a draft that is already approved (not pending)", async () => {
    await createSession(adminId);
    const draft = await prisma.emailDraft.findFirstOrThrow({ where: { caseId, status: "APPROVED" } });
    const response = await patchDraft(request("PATCH", { action: "approve" }), { params: Promise.resolve({ id: caseId, draftId: draft.id }) });
    expect(response.status).toBe(409);
  });

  it("discards a fresh draft without approving it", async () => {
    await createSession(adminId);
    const created = await postDraft(request("POST"), { params: Promise.resolve({ id: caseId }) });
    const { draft } = await created.json();

    const response = await patchDraft(request("PATCH", { action: "discard" }), { params: Promise.resolve({ id: caseId, draftId: draft.id }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.draft.status).toBe("DISCARDED");
    expect(body.draft.approvedAt).toBeNull();

    const audit = await prisma.auditLog.findFirst({ where: { action: "DRAFT_DISCARDED", caseId }, orderBy: { createdAt: "desc" } });
    expect(audit).toBeTruthy();
  });
});
