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
const { PATCH: patchField } = await import("@/app/api/cases/[id]/fields/[fieldKey]/route");
const { PATCH: patchAssign } = await import("@/app/api/cases/[id]/assign/route");
const { PATCH: patchStatus } = await import("@/app/api/cases/[id]/status/route");
const { PATCH: patchReview } = await import("@/app/api/cases/[id]/review/route");

function jsonRequest(body: unknown) {
  return new Request("http://localhost/test", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Case detail action routes (SPEC.md §10)", () => {
  let caseId: string;
  let adminId: string;
  let readOnlyId: string;
  let otherUserId: string;

  beforeAll(async () => {
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    const readOnly = await prisma.user.findFirstOrThrow({ where: { role: "READ_ONLY" } });
    const other = await prisma.user.findFirstOrThrow({ where: { role: "OPERATIONS" } });
    adminId = admin.id;
    readOnlyId = readOnly.id;
    otherUserId = other.id;

    const created = await prisma.case.create({
      data: {
        reference: `TEST-ACTIONS-${Date.now()}`,
        title: "Pratica di test azioni",
        category: "QUOTE_REQUEST",
        status: "NEW",
        priority: "NORMAL",
      },
    });
    caseId = created.id;

    await prisma.caseField.create({
      data: { caseId, fieldKey: "customer_name", value: "Cliente Test", needsHumanReview: true },
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
    const response = await patchField(jsonRequest({}), { params: Promise.resolve({ id: caseId, fieldKey: "customer_name" }) });
    expect(response.status).toBe(403);
  });

  it("confirms a field: clears needsHumanReview and writes FIELD_CONFIRMED audit", async () => {
    await createSession(adminId);
    const response = await patchField(jsonRequest({}), { params: Promise.resolve({ id: caseId, fieldKey: "customer_name" }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.field.needsHumanReview).toBe(false);
    expect(body.field.confirmedById).toBe(adminId);

    const audit = await prisma.auditLog.findFirst({ where: { action: "FIELD_CONFIRMED", caseId }, orderBy: { createdAt: "desc" } });
    expect(audit).toBeTruthy();
    expect(audit?.actorId).toBe(adminId);
  });

  it("corrects a field value and writes FIELD_UPDATED audit", async () => {
    await createSession(adminId);
    const response = await patchField(jsonRequest({ value: "Cliente Corretto" }), {
      params: Promise.resolve({ id: caseId, fieldKey: "customer_name" }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.field.value).toBe("Cliente Corretto");

    const audit = await prisma.auditLog.findFirst({ where: { action: "FIELD_UPDATED", caseId }, orderBy: { createdAt: "desc" } });
    expect(audit).toBeTruthy();
  });

  it("assigns a responsible user and writes ASSIGNEE_CHANGED audit", async () => {
    await createSession(adminId);
    const response = await patchAssign(jsonRequest({ assignedToId: otherUserId }), { params: Promise.resolve({ id: caseId }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.case.assignedToId).toBe(otherUserId);

    const audit = await prisma.auditLog.findFirst({ where: { action: "ASSIGNEE_CHANGED", caseId }, orderBy: { createdAt: "desc" } });
    expect(audit).toBeTruthy();
  });

  it("changes status to COMPLETED, stamps completedAt, and writes STATUS_CHANGED audit", async () => {
    await createSession(adminId);
    const response = await patchStatus(jsonRequest({ status: "COMPLETED" }), { params: Promise.resolve({ id: caseId }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.case.status).toBe("COMPLETED");
    expect(body.case.completedAt).toBeTruthy();

    const audit = await prisma.auditLog.findFirst({ where: { action: "STATUS_CHANGED", caseId }, orderBy: { createdAt: "desc" } });
    expect(audit).toBeTruthy();
  });

  it("rejects an invalid status value", async () => {
    await createSession(adminId);
    const response = await patchStatus(jsonRequest({ status: "NOT_A_STATUS" }), { params: Promise.resolve({ id: caseId }) });
    expect(response.status).toBe(400);
  });

  it("clears needsHumanReview via the review queue action", async () => {
    await prisma.case.update({ where: { id: caseId }, data: { needsHumanReview: true } });
    await createSession(adminId);
    const response = await patchReview(new Request("http://localhost/test", { method: "PATCH" }), { params: Promise.resolve({ id: caseId }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.case.needsHumanReview).toBe(false);

    const audit = await prisma.auditLog.findFirst({ where: { action: "ADMIN_ACTION", caseId }, orderBy: { createdAt: "desc" } });
    expect(audit).toBeTruthy();
  });
});
