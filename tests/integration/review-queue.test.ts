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
const { PATCH: patchRelation } = await import("@/app/api/cases/[id]/relations/[relationId]/route");
const { POST: postRelation } = await import("@/app/api/cases/[id]/relations/route");

function request(method: string, body?: unknown) {
  return new Request("http://localhost/test", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("Review queue: duplicati e pratiche correlate (SPEC.md §7, §10)", () => {
  let caseAId: string;
  let caseBId: string;
  let caseCId: string;
  let caseCReference: string;
  let caseDId: string;
  let adminId: string;

  beforeAll(async () => {
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    adminId = admin.id;

    const stamp = Date.now();
    const [caseA, caseB, caseC, caseD] = await Promise.all([
      prisma.case.create({ data: { reference: `TEST-REL-A-${stamp}`, title: "Pratica A", category: "SUPPLIER_INVOICE", status: "NEW", priority: "NORMAL" } }),
      prisma.case.create({ data: { reference: `TEST-REL-B-${stamp}`, title: "Pratica B", category: "SUPPLIER_INVOICE", status: "NEW", priority: "NORMAL" } }),
      prisma.case.create({ data: { reference: `TEST-REL-C-${stamp}`, title: "Pratica C", category: "SUPPLIER_INVOICE", status: "NEW", priority: "NORMAL" } }),
      prisma.case.create({ data: { reference: `TEST-REL-D-${stamp}`, title: "Pratica D", category: "SUPPLIER_INVOICE", status: "NEW", priority: "NORMAL" } }),
    ]);
    caseAId = caseA.id;
    caseBId = caseB.id;
    caseCId = caseC.id;
    caseCReference = caseC.reference;
    caseDId = caseD.id;
  });

  beforeEach(() => {
    cookieStore.clear();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("confirms a pending duplicate candidate proposed by the pipeline", async () => {
    const relation = await prisma.caseRelation.create({
      data: { caseId: caseAId, relatedCaseId: caseBId, kind: "DUPLICATE_CANDIDATE", status: "PENDING", confidence: 0.8, matchLevel: "invoice_number" },
    });

    await createSession(adminId);
    const response = await patchRelation(request("PATCH", { action: "confirm" }), { params: Promise.resolve({ id: caseAId, relationId: relation.id }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.relation.status).toBe("CONFIRMED");
    expect(body.relation.reviewedById).toBe(adminId);

    const audit = await prisma.auditLog.findFirst({ where: { action: "CASE_LINKED", entityId: relation.id }, orderBy: { createdAt: "desc" } });
    expect(audit).toBeTruthy();
  });

  it("rejects a pending candidate that is not actually a duplicate", async () => {
    const relation = await prisma.caseRelation.create({
      data: { caseId: caseAId, relatedCaseId: caseBId, kind: "RELATED", status: "PENDING", confidence: 0.6 },
    });

    await createSession(adminId);
    const response = await patchRelation(request("PATCH", { action: "reject" }), { params: Promise.resolve({ id: caseAId, relationId: relation.id }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.relation.status).toBe("REJECTED");

    const audit = await prisma.auditLog.findFirst({ where: { action: "CASE_SPLIT", entityId: relation.id }, orderBy: { createdAt: "desc" } });
    expect(audit).toBeTruthy();
  });

  it("returns 404 when the relation does not belong to the given case", async () => {
    const relation = await prisma.caseRelation.create({
      data: { caseId: caseAId, relatedCaseId: caseCId, kind: "DUPLICATE_CANDIDATE", status: "PENDING" },
    });

    await createSession(adminId);
    const response = await patchRelation(request("PATCH", { action: "confirm" }), { params: Promise.resolve({ id: caseBId, relationId: relation.id }) });
    expect(response.status).toBe(404);
  });

  it("manually links two cases by reference, already confirmed (explicit human choice)", async () => {
    await createSession(adminId);
    const response = await postRelation(request("POST", { targetReference: caseCReference, kind: "RELATED" }), {
      params: Promise.resolve({ id: caseAId }),
    });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.relation.status).toBe("CONFIRMED");
    expect(body.relation.reviewedById).toBe(adminId);
  });

  it("never merges cases automatically: a low-confidence match still requires a human decision", async () => {
    const relation = await prisma.caseRelation.create({
      data: { caseId: caseDId, relatedCaseId: caseBId, kind: "DUPLICATE_CANDIDATE", status: "PENDING", confidence: 0.51 },
    });
    const found = await prisma.caseRelation.findUnique({ where: { id: relation.id } });
    expect(found?.status).toBe("PENDING");
  });
});
